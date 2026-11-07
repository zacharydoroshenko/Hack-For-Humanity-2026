/**
 * In-browser mock backend. It implements the frozen contract (shared/types.ts) with
 * dummy routing so the UI can be built and demoed without the real backend.
 *
 * It mimics the real design: deterministic routing, plus "AI" outputs (request parsing,
 * alert interpretation, reroute explanation) that are templated here and marked ai_generated.
 */
import type {
  AlertIngestRequest,
  CarLeg,
  TravelMode,
  AlertIngestResponse,
  ClosureFeature,
  LayersResponse,
  Leg,
  LngLat,
  ParsedRequest,
  PlanRequest,
  PlanResponse,
  RouteWarning,
  Step,
  TransitLeg,
  WalkLeg,
} from "@shared/types";
import {
  AVG_WAIT_MIN,
  BASE_CLOSURES,
  BLUE_LINE_COLOR,
  CURB_RAMPS,
  DEMO_ALERTS,
  PLACES,
  STATIONS,
  baseStops,
  type Place,
  type Station,
} from "./data";

const ROLL_M_PER_MIN = 60; // ~1 m/s wheelchair pace
const DETOUR_FACTOR = 1.3; // straight line → street distance

// ───────── state ─────────
const ingested = new Map<string, { closure: ClosureFeature; alternative_stop_id: string | null }>();

export function resetMock() {
  ingested.clear();
}

// ───────── geo helpers ─────────
export function haversine([lon1, lat1]: LngLat, [lon2, lat2]: LngLat): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const pathLength = (pts: LngLat[]) => pts.slice(1).reduce((sum, p, i) => sum + haversine(pts[i], p), 0);

function cardinal([lon1, lat1]: LngLat, [lon2, lat2]: LngLat): string {
  const dx = lon2 - lon1;
  const dy = lat2 - lat1;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "east" : "west";
  return dy > 0 ? "north" : "south";
}

const round10 = (m: number) => Math.max(10, Math.round(m / 10) * 10);

// ───────── request parsing ("AI") ─────────
function findPlace(fragment: string): Place | null {
  const f = fragment.toLowerCase();
  let best: Place | null = null;
  let bestLen = 0;
  for (const p of PLACES) {
    for (const key of [p.name.toLowerCase(), ...p.aliases]) {
      if (f.includes(key) && key.length > bestLen) {
        best = p;
        bestLen = key.length;
      }
    }
  }
  return best;
}

export function parseRequest(text: string, req: PlanRequest): { parsed: ParsedRequest; from?: LngLat; to?: LngLat } {
  const t = text.toLowerCase();
  let max_grade = req.max_grade ?? 0.05;
  if (/manual|hill|steep|tired|gentle/.test(t)) max_grade = 0.04;
  if (/power chair|power wheelchair|scooter|ada ramp/.test(t)) max_grade = 0.0833;
  const avoid_unverified = req.avoid_unverified || /verified|certain|sure|known/.test(t);

  // "from X to Y" / "X to Y"
  let fromPlace: Place | null = null;
  let toPlace: Place | null = null;
  const m = t.match(/(?:from\s+)?(.+?)\s+(?:to|→|->)\s+(.+)/);
  if (m) {
    fromPlace = findPlace(m[1]);
    toPlace = findPlace(m[2]);
  }
  if (!toPlace) toPlace = findPlace(t);

  return {
    parsed: {
      from_text: fromPlace?.name ?? null,
      to_text: toPlace?.name ?? null,
      max_grade,
      avoid_unverified,
      ai_generated: true,
    },
    from: fromPlace?.coord,
    to: toPlace?.coord,
  };
}

// ───────── closures ─────────
function activeClosures(): ClosureFeature[] {
  return [...BASE_CLOSURES, ...[...ingested.values()].map((v) => v.closure)];
}

function blockedStopIds(closures: ClosureFeature[]): Set<string> {
  return new Set(
    closures.filter((c) => c.properties.severity === "blocking" && c.properties.stop_id).map((c) => c.properties.stop_id!),
  );
}

// ───────── walk legs ─────────
interface WalkOpts {
  max_grade: number;
  avoid_unverified: boolean;
}

function walkLeg(from: LngLat, to: LngLat, toName: string, opts: WalkOpts, station?: { s: Station; boarding: boolean }): WalkLeg {
  // dog-leg path that looks like streets
  const midLon = from[0] + (to[0] - from[0]) * 0.5;
  const coords: LngLat[] = [from, [midLon, from[1]], [midLon, to[1]], to];
  let distance = pathLength(coords) * (DETOUR_FACTOR / 1.15);
  const warnings: RouteWarning[] = [];
  const steps: Step[] = [];

  for (let i = 0; i < coords.length - 1; i++) {
    const seg = haversine(coords[i], coords[i + 1]);
    if (seg < 15) continue;
    steps.push({ instruction: `${steps.length === 0 ? "Head" : "Continue"} ${cardinal(coords[i], coords[i + 1])}`, distance_m: round10(seg) });
  }

  if (distance > 350) {
    const unverified = round10(distance * 0.12);
    if (opts.avoid_unverified) {
      distance *= 1.12;
      steps.push({ instruction: "Detour onto verified sidewalks", distance_m: round10(distance * 0.1) });
    } else {
      warnings.push({ type: "unverified", message: `Sidewalk accessibility not verified for ${unverified} m` });
    }
  }

  for (const ramp of CURB_RAMPS) {
    const near = coords.some((c) => haversine(c, ramp.geometry.coordinates) < 300);
    if (near) {
      warnings.push({ type: "missing_curb_ramp", message: `Detoured around: ${ramp.properties.description ?? "curb ramp issue"}` });
      distance += 60;
    }
  }

  if (station) {
    const { s, boarding } = station;
    const how = s.access === "elevator" ? "Take the elevator" : s.access === "ramp" ? "Take the ramp" : "Roll level";
    steps.push({
      instruction: boarding ? `${how} to the ${s.name} platform` : `${how} from the platform to street level`,
      distance_m: 40,
    });
    if (s.exitGrade > 0.04 && s.exitGrade <= opts.max_grade) {
      warnings.push({ type: "steep", message: `Slope up to ${(s.exitGrade * 100).toFixed(1)}% near ${s.name}` });
    }
  }
  steps.push({ instruction: `Arrive at ${toName}`, distance_m: 0 });

  return {
    mode: "walk",
    geometry: { type: "LineString", coordinates: coords },
    distance_m: Math.round(distance),
    duration_min: Math.max(1, Math.round(distance / ROLL_M_PER_MIN)),
    warnings,
    steps,
  };
}

function transitLeg(a: Station, b: Station): TransitLeg {
  const i = STATIONS.indexOf(a);
  const j = STATIONS.indexOf(b);
  const slice = i < j ? STATIONS.slice(i, j + 1) : STATIONS.slice(j, i + 1).reverse();
  return {
    mode: "transit",
    route_short_name: "Blue",
    route_color: BLUE_LINE_COLOR,
    from_stop: { stop_id: a.stop_id, name: a.name, wheelchair_boarding: 0 },
    to_stop: { stop_id: b.stop_id, name: b.name, wheelchair_boarding: 0 },
    duration_min: Math.abs(a.minute - b.minute),
    geometry: { type: "LineString", coordinates: slice.map((s) => s.coord) },
  };
}

// ───────── car legs ─────────
const CAR_M_PER_MIN = 500; // ~30 km/h average in city traffic
const RIDESHARE_WAIT_MIN = 9; // wheelchair-accessible vehicles take longer to arrive

function carLeg(from: LngLat, to: LngLat, toName: string, kind: "drive" | "rideshare"): CarLeg {
  const midLat = from[1] + (to[1] - from[1]) * 0.5;
  const coords: LngLat[] = [from, [from[0], midLat], [to[0], midLat], to];
  const distance = Math.round(haversine(from, to) * 1.35);
  const drive = Math.max(3, Math.round(distance / CAR_M_PER_MIN));
  const steps: Step[] =
    kind === "rideshare"
      ? [
          { instruction: `Wait about ${RIDESHARE_WAIT_MIN} min for a wheelchair-accessible vehicle`, distance_m: 0 },
          { instruction: `Ride to ${toName}`, distance_m: round10(distance) },
        ]
      : [
          { instruction: `Drive to ${toName}`, distance_m: round10(distance) },
          { instruction: "Park in an accessible (ADA) space near the entrance", distance_m: 0 },
        ];
  return {
    mode: kind,
    geometry: { type: "LineString", coordinates: coords },
    distance_m: distance,
    duration_min: drive + (kind === "rideshare" ? RIDESHARE_WAIT_MIN : 3),
    steps,
    warnings: [],
    note:
      kind === "rideshare"
        ? "Request a wheelchair-accessible vehicle (WAV) in your rideshare app. Availability varies by time of day."
        : "Accessible parking near the destination is not verified.",
  };
}

function shortRoll(from: LngLat, toName: string): WalkLeg {
  const to: LngLat = [from[0] + 0.0004, from[1] + 0.0002];
  return {
    mode: "walk",
    geometry: { type: "LineString", coordinates: [from, to] },
    distance_m: 40,
    duration_min: 1,
    warnings: [],
    steps: [{ instruction: `Arrive at ${toName}`, distance_m: 40 }],
  };
}

// ───────── trip planning ─────────
interface Trip {
  legs: Leg[];
  board?: Station;
  alight?: Station;
  total: number;
  /** estimated metres of rolling */
  walkM: number;
}

/** Every way to do one segment (roll-only + each usable station pair), best first. Legs are built later. */
function candidates(from: LngLat, to: LngLat, opts: WalkOpts, closures: ClosureFeature[], preferStopIds: Set<string>): Trip[] {
  const blocked = blockedStopIds(closures);
  const usable = STATIONS.filter((s) => !blocked.has(s.stop_id) && s.exitGrade <= opts.max_grade);
  const direct = haversine(from, to) * DETOUR_FACTOR;
  const out: Trip[] = [{ legs: [], total: direct / ROLL_M_PER_MIN, walkM: direct }];
  for (const a of usable) {
    for (const b of usable) {
      if (a === b) continue;
      const w1 = haversine(from, a.coord) * DETOUR_FACTOR;
      const w2 = haversine(b.coord, to) * DETOUR_FACTOR;
      const bonus = preferStopIds.has(a.stop_id) || preferStopIds.has(b.stop_id) ? -3 : 0;
      const total = w1 / ROLL_M_PER_MIN + AVG_WAIT_MIN + Math.abs(a.minute - b.minute) + w2 / ROLL_M_PER_MIN + bonus;
      out.push({ legs: [], board: a, alight: b, total, walkM: w1 + w2 });
    }
  }
  return out.sort((x, y) => x.total - y.total);
}

type Strategy = "fastest" | "least_rolling" | "alternate" | "roll_only";
const STRATEGY_LABEL: Record<Strategy, string> = {
  fastest: "Fastest",
  least_rolling: "Least rolling",
  alternate: "Other station",
  roll_only: "Roll the whole way",
};
const ROLL_ONLY_MAX_MIN = 60;

function pick(cands: Trip[], strategy: Strategy): Trip | null {
  const best = cands[0];
  if (strategy === "fastest") return best;
  if (strategy === "alternate") {
    // best trolley trip that uses a different station than the fastest one
    return cands.find((c) => c.board && c !== best && (c.board !== best.board || c.alight !== best.alight) && c.total <= best.total + 20) ?? null;
  }
  if (strategy === "roll_only") {
    const r = cands.find((c) => !c.board);
    return r && r.total <= ROLL_ONLY_MAX_MIN ? r : null;
  }
  // least rolling: fewest metres among trips at most 15 min slower than the fastest
  return cands.filter((c) => c.total <= best.total + 15).sort((a, b) => a.walkM - b.walkM)[0] ?? null;
}

function build(t: Trip, from: LngLat, to: LngLat, toName: string, opts: WalkOpts): Trip {
  const legs: Leg[] =
    t.board && t.alight
      ? [
          walkLeg(from, t.board.coord, t.board.name, opts, { s: t.board, boarding: true }),
          transitLeg(t.board, t.alight),
          walkLeg(t.alight.coord, to, toName, opts, { s: t.alight, boarding: false }),
        ]
      : [walkLeg(from, to, toName, opts)];
  return { ...t, legs };
}

/** Plan [from, ...via, to] segment by segment with one strategy. null if the strategy doesn't apply. */
function planChain(points: LngLat[], names: string[], opts: WalkOpts, closures: ClosureFeature[], prefer: Set<string>, strategy: Strategy): Trip[] | null {
  const segs: Trip[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const cands = candidates(points[i], points[i + 1], opts, closures, prefer);
    // "Other station" only needs to differ somewhere; legs without an alternative use their fastest route
    const t = pick(cands, strategy) ?? (strategy === "alternate" ? cands[0] : null);
    if (!t) return null;
    segs.push(build(t, points[i], points[i + 1], names[i + 1], opts));
  }
  return segs;
}

const chainKey = (segs: Trip[]) => segs.map((t) => `${t.board?.stop_id ?? "-"}>${t.alight?.stop_id ?? "-"}`).join("|");

function summarize(legs: Leg[]) {
  const walk_m = legs.reduce((s, l) => s + (l.mode === "walk" ? l.distance_m : 0), 0);
  const transit = legs.filter((l) => l.mode === "transit").length;
  const duration_min = legs.reduce((s, l) => s + l.duration_min, 0) + (transit ? AVG_WAIT_MIN : 0);
  return { duration_min: Math.round(duration_min), walk_m: Math.round(walk_m), transfers: Math.max(0, transit - 1) };
}

function explain(normal: Trip, actual: Trip, causes: ClosureFeature[]): string[] {
  const addedMin = summarize(actual.legs).duration_min - summarize(normal.legs).duration_min;
  const out: string[] = [];
  for (const c of causes) {
    const p = c.properties;
    out.push(
      p.kind === "elevator_outage"
        ? `${p.title.replace(/^Elevator out at /, "The elevator at ")} is out of service, so you couldn't get between the platform and the street there.`
        : `${p.title}, so trains can't be used there right now.`,
    );
    if (p.alternative) out.push(`MTS suggests: "${p.alternative}."`);
  }
  if (normal.board?.stop_id !== actual.board?.stop_id && actual.board) {
    out.push(`You'll board at ${actual.board.name} instead of ${normal.board?.name ?? "walking the whole way"}.`);
  }
  if (normal.alight?.stop_id !== actual.alight?.stop_id && actual.alight) {
    out.push(`You'll get off at ${actual.alight.name} instead of ${normal.alight?.name ?? "the original stop"}.`);
  }
  if (!actual.board) out.push("No accessible trolley option fits this trip right now, so the route rolls the whole way.");
  out.push(
    `${addedMin > 0 ? `The new route adds ${addedMin} min` : "The new route takes about the same time"} and keeps every sidewalk at or under your slope limit.`,
  );
  return out;
}

export function mockPlan(req: PlanRequest): PlanResponse {
  let parsed: ParsedRequest | null = null;
  let from = req.from;
  let to = req.to;
  let toName = "your destination";

  if (req.text?.trim()) {
    const r = parseRequest(req.text, req);
    parsed = r.parsed;
    from = r.from ?? from;
    to = r.to ?? to;
    if (r.parsed.to_text) toName = r.parsed.to_text;
  }
  if (!from || !to) throw new Error("422: Set a start and destination (click the map, pick a place, or name them in your request).");

  const opts: WalkOpts = {
    max_grade: parsed?.max_grade ?? req.max_grade ?? 0.05,
    avoid_unverified: parsed?.avoid_unverified ?? req.avoid_unverified ?? false,
  };

  const mode: TravelMode = req.mode ?? "transit";
  if (mode === "drive" || mode === "rideshare") {
    const legs: Leg[] = [carLeg(from, to, toName, mode), shortRoll(to, toName)];
    return { mode, parsed_request: parsed, summary: summarize(legs), legs, rerouted: false, reroute: null };
  }
  if (mode === "walk") {
    const legs: Leg[] = [walkLeg(from, to, toName, opts)];
    return { mode, parsed_request: parsed, summary: summarize(legs), legs, rerouted: false, reroute: null };
  }

  const closures = activeClosures();
  const prefer = new Set([...ingested.values()].map((v) => v.alternative_stop_id).filter((x): x is string => !!x));
  const via = req.via ?? [];
  const points: LngLat[] = [from, ...via, to];
  const names = ["start", ...via.map((_, i) => `stop ${i + 1}`), toName];

  // Candidate routes, best first, de-duplicated
  const options: { strategy: Strategy; segs: Trip[] }[] = [];
  const seen = new Set<string>();
  for (const strategy of ["fastest", "least_rolling", "alternate", "roll_only"] as Strategy[]) {
    const segs = planChain(points, names, opts, closures, prefer, strategy);
    if (!segs || seen.has(chainKey(segs))) continue;
    seen.add(chainKey(segs));
    options.push({ strategy, segs });
  }
  const actualSegs = options[0].segs;
  const normalSegs = planChain(points, names, opts, BASE_CLOSURES, new Set(), "fastest")!;

  // Rerouted if an ingested outage blocks a station the no-outage plan would have used
  const blocked = blockedStopIds(closures);
  const normalStops = new Set(normalSegs.flatMap((t) => [t.board?.stop_id, t.alight?.stop_id]).filter(Boolean) as string[]);
  const causes = [...ingested.values()]
    .map((v) => v.closure)
    .filter((c) => c.properties.stop_id && blocked.has(c.properties.stop_id) && normalStops.has(c.properties.stop_id));
  const changedIdx = actualSegs.findIndex((t, i) => chainKey([t]) !== chainKey([normalSegs[i]]));
  const rerouted = changedIdx >= 0 && causes.length > 0;

  const legsOf = (segs: Trip[]) => segs.flatMap((t) => t.legs);
  const routeOptions = options.map((o, i) => {
    const legs = legsOf(o.segs);
    let label = STRATEGY_LABEL[o.strategy];
    if (o.strategy === "alternate") {
      const t = o.segs.find((x, k) => x.board && chainKey([x]) !== chainKey([options[0].segs[k]]));
      const f = options[0].segs[o.segs.indexOf(t!)];
      if (t?.board && t.board !== f?.board) label = `Board at ${t.board.name.replace(/ Station$/, "")}`;
      else if (t?.alight) label = `Get off at ${t.alight.name.replace(/ Station$/, "")}`;
    }
    return { id: `opt_${i}_${o.strategy}`, label, summary: summarize(legs), legs };
  });
  const legs = routeOptions[0].legs;

  return {
    mode,
    parsed_request: parsed,
    summary: routeOptions[0].summary,
    legs,
    rerouted,
    reroute: rerouted
      ? {
          cause_closure_ids: causes.map((c) => c.properties.id),
          explanation: explain(
            { ...normalSegs[changedIdx], legs: legsOf(normalSegs) },
            { ...actualSegs[changedIdx], legs },
            causes,
          ),
          ai_generated: true,
        }
      : null,
    options: routeOptions,
  };
}

export function mockLayers(): LayersResponse {
  const closures = activeClosures();
  const byStop = new Map<string, string[]>();
  for (const c of closures) {
    if (!c.properties.stop_id) continue;
    byStop.set(c.properties.stop_id, [...(byStop.get(c.properties.stop_id) ?? []), c.properties.id]);
  }
  const stops = baseStops();
  for (const s of stops) s.properties.active_closure_ids = byStop.get(s.properties.stop_id) ?? [];
  return {
    stops: { type: "FeatureCollection", features: stops },
    closures: { type: "FeatureCollection", features: structuredClone(closures) },
    curb_ramps: { type: "FeatureCollection", features: structuredClone(CURB_RAMPS) },
  };
}

export function mockIngest(req: AlertIngestRequest): AlertIngestResponse {
  const alert = DEMO_ALERTS.find((a) => a.file === req.demo_file) ?? DEMO_ALERTS[0];
  ingested.set(alert.closure.properties.id, { closure: structuredClone(alert.closure), alternative_stop_id: alert.alternative_stop_id });
  return { closure: structuredClone(alert.closure) };
}
