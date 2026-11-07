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
  RouteOption,
  RouteWarning,
  Step,
  TransitLeg,
  WalkLeg,
} from "@shared/types";
import { slopeStats } from "./terrain";
import {
  AVG_WAIT_MIN,
  BASE_CLOSURES,
  REAL_MTS_CLOSURES,
  BLUE_LINE_COLOR,
  CURB_RAMPS,
  GET_IT_DONE,
  STEEP_STREETS,
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
  return [...BASE_CLOSURES, ...REAL_MTS_CLOSURES, ...[...ingested.values()].map((v) => v.closure)];
}

// ── real-closure proximity (construction near a bus stop usually blocks the curb/sidewalk) ──
const NEAR_CLOSURE_M = 300;
const CONSTRUCTION_COST_MIN = 15;
function distToSegment(p: LngLat, a: LngLat, b: LngLat): number {
  const k = Math.cos((p[1] * Math.PI) / 180) * 111320;
  const P = [p[0] * k, p[1] * 111320], A = [a[0] * k, a[1] * 111320], B = [b[0] * k, b[1] * 111320];
  const dx = B[0] - A[0], dy = B[1] - A[1];
  const t = dx || dy ? Math.max(0, Math.min(1, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(P[0] - (A[0] + t * dx), P[1] - (A[1] + t * dy));
}
function nearPath(p: LngLat, path: LngLat[], within: number): boolean {
  for (let i = 0; i < path.length - 1; i++) if (distToSegment(p, path[i], path[i + 1]) < within) return true;
  return false;
}
function closuresNear(path: LngLat[]): ClosureFeature[] {
  return REAL_MTS_CLOSURES.filter((c) => nearPath(c.geometry.coordinates as LngLat, path, NEAR_CLOSURE_M));
}
const NEAR_REPORT_M = 120; // Get It Done reports / curb ramps this close to the roll are mentioned
const NEAR_RAMP_M = 90;
const MAX_LISTED = 2; // per leg, per kind; the rest are summarised
function listNear<T>(items: T[], at: (t: T) => LngLat, path: LngLat[], within: number): T[] {
  return items.filter((t) => nearPath(at(t), path, within));
}
/** A rolling leg is "too steep" if its average grade is above the rider's limit. */
const tooSteep = (path: LngLat[], maxGrade: number) => slopeStats(path).avgGrade > maxGrade;
/** same dog-leg shape walkLeg() draws */
const dogleg = (a: LngLat, b: LngLat): LngLat[] => {
  const midLon = a[0] + (b[0] - a[0]) * 0.5;
  return [a, [midLon, a[1]], [midLon, b[1]], b];
};

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

// ── real rolling paths (Valhalla wheelchair profile), filled in by the client between two planning passes ──
export interface RealPathData {
  coords: LngLat[];
  distance_m: number;
  steps: Step[];
}
const pathKey = (a: LngLat, b: LngLat) => `${a[0].toFixed(5)},${a[1].toFixed(5)}>${b[0].toFixed(5)},${b[1].toFixed(5)}`;
/** key -> real path, or null if the router had no route (use the simple line) */
const realPaths = new Map<string, RealPathData | null>();
const wantedPaths = new Map<string, [LngLat, LngLat]>();
/** Rolling legs the last plan drew as simple lines because no real path was known yet. */
export function takeWantedPaths(): [LngLat, LngLat][] {
  const out = [...wantedPaths.values()];
  wantedPaths.clear();
  return out;
}
export function setRealPath(from: LngLat, to: LngLat, path: RealPathData | null): void {
  realPaths.set(pathKey(from, to), path);
}

function walkLeg(from: LngLat, to: LngLat, toName: string, opts: WalkOpts, station?: { s: Station; boarding: boolean }): WalkLeg {
  const key = pathKey(from, to);
  const real = realPaths.get(key) ?? null;
  if (!realPaths.has(key)) wantedPaths.set(key, [from, to]);

  // real sidewalk path when available, otherwise a street-like dog-leg placeholder
  const midLon = from[0] + (to[0] - from[0]) * 0.5;
  const coords: LngLat[] = real ? real.coords : [from, [midLon, from[1]], [midLon, to[1]], to];
  let distance = real ? real.distance_m : pathLength(coords) * (DETOUR_FACTOR / 1.15);
  // problems are matched to the path: tighter on a real path than on the placeholder line
  const near = real ? { closure: 90, report: 35, ramp: 35, block: 60 } : { closure: NEAR_CLOSURE_M, report: NEAR_REPORT_M, ramp: NEAR_RAMP_M, block: NEAR_STREET_BLOCK_M };
  const warnings: RouteWarning[] = [];
  const steps: Step[] = real ? real.steps.map((x) => ({ ...x })) : [];

  if (!real) {
    for (let i = 0; i < coords.length - 1; i++) {
      const seg = haversine(coords[i], coords[i + 1]);
      if (seg < 15) continue;
      steps.push({ instruction: `${steps.length === 0 ? "Head" : "Continue"} ${cardinal(coords[i], coords[i + 1])}`, distance_m: round10(seg) });
    }
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

  for (const c of REAL_MTS_CLOSURES.filter((c) => nearPath(c.geometry.coordinates as LngLat, coords, near.closure))) {
    warnings.push({ type: "hazard", message: `MTS reports construction at ${c.properties.title.replace(/^Construction: /, "")}; expect a blocked curb` });
  }

  // REAL: USGS elevation along the roll
  const slope = slopeStats(coords);
  if (slope.avgGrade > 0.03 || slope.climbM >= 20) {
    const uphill = slope.climbM >= slope.descentM;
    warnings.push({
      type: "steep",
      message: `${uphill ? "Climbs" : "Descends"} ${uphill ? slope.climbM : slope.descentM} m over ${(slope.lengthM / 1000).toFixed(1)} km (avg ${(slope.avgGrade * 100).toFixed(1)}%${slope.avgGrade > opts.max_grade ? ", above your limit" : ""})`,
    });
  }
  for (const street of STEEP_STREETS) {
    const line = street.geometry.coordinates as LngLat[];
    if (line.some((p) => nearPath(p, coords, near.report))) warnings.push({ type: "steep", message: street.properties.title.replace(/^Steep: /, "Steep street: ") });
  }

  // LIVE: street-level events that arrived as alerts (blocked sidewalks, torn-out ramps)
  for (const c of [...ingested.values()].map((v) => v.closure)) {
    if (c.properties.stop_id || !nearPath(c.geometry.coordinates as LngLat, coords, near.block)) continue;
    warnings.push({
      type: c.properties.kind === "missing_curb_ramp" ? "missing_curb_ramp" : "hazard",
      message: `Live: ${c.properties.title}${c.properties.alternative ? `. ${c.properties.alternative}` : ""}`,
    });
  }

  // REAL: City curb-ramp needs at intersections along the roll
  const ramps = listNear(CURB_RAMPS, (r) => r.geometry.coordinates, coords, near.ramp);
  ramps.slice(0, MAX_LISTED).forEach((r) => warnings.push({ type: "missing_curb_ramp", message: `Detour for curb ramps: ${r.properties.description}` }));
  if (ramps.length > MAX_LISTED) warnings.push({ type: "missing_curb_ramp", message: `${ramps.length - MAX_LISTED} more intersection${ramps.length - MAX_LISTED === 1 ? "" : "s"} with missing or non-compliant curb ramps` });
  if (!real) distance += ramps.length * 60; // the real path already includes its detours

  // REAL: open Get It Done sidewalk reports along the roll
  const reports = listNear(GET_IT_DONE, (r) => r.geometry.coordinates as LngLat, coords, near.report);
  reports.slice(0, MAX_LISTED).forEach((r) =>
    warnings.push({ type: "hazard", message: `${r.properties.title} (${r.properties.description?.split(" · ")[0]})` }),
  );
  if (reports.length > MAX_LISTED) warnings.push({ type: "hazard", message: `${reports.length - MAX_LISTED} more open sidewalk report${reports.length - MAX_LISTED === 1 ? "" : "s"} on this stretch (Get It Done)` });

  if (station) {
    const { s, boarding } = station;
    const how = s.access === "elevator" ? "Take the elevator" : s.access === "ramp" ? "Take the ramp" : "Roll level";
    steps.push({
      instruction: boarding ? `${how} to the ${s.name} platform` : `${how} from the platform to street level`,
      distance_m: 40,
    });
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
  /** real MTS construction closures next to the rolling parts */
  closures: number;
}

/** Every way to do one segment (roll-only + each usable station pair), best first. Legs are built later. */
const NEAR_STREET_BLOCK_M = 150;
/** Blocking closures that aren't a station (e.g. a fenced-off sidewalk): no route may roll past them. */
const streetBlocks = (closures: ClosureFeature[]) => closures.filter((c) => c.properties.severity === "blocking" && !c.properties.stop_id);
const passesBlock = (path: LngLat[], blocks: ClosureFeature[]) =>
  blocks.some((c) => nearPath(c.geometry.coordinates as LngLat, path, NEAR_STREET_BLOCK_M));

function candidates(from: LngLat, to: LngLat, opts: WalkOpts, closures: ClosureFeature[], preferStopIds: Set<string>, relaxed = false): Trip[] {
  const blocked = blockedStopIds(closures);
  const usable = STATIONS.filter((s) => !blocked.has(s.stop_id));
  // the real path if we have it, otherwise the same placeholder walkLeg() draws, so ranking matches what the user sees
  const pathFor = (a: LngLat, b: LngLat) => realPaths.get(pathKey(a, b))?.coords ?? dogleg(a, b);
  const rollM = (a: LngLat, b: LngLat) => realPaths.get(pathKey(a, b))?.distance_m ?? pathLength(dogleg(a, b)) * (DETOUR_FACTOR / 1.15);
  const nClosures = (a: LngLat, b: LngLat) => closuresNear(pathFor(a, b)).length;
  const directM = rollM(from, to);
  // REAL slope: rolling to/from each station, checked once per station
  const blocks = relaxed ? [] : streetBlocks(closures);
  const maxGrade = relaxed ? Infinity : opts.max_grade;
  const bad = (path: LngLat[]) => tooSteep(path, maxGrade) || passesBlock(path, blocks);
  const steepFrom = new Map(usable.map((st) => [st, bad(pathFor(from, st.coord))]));
  const steepTo = new Map(usable.map((st) => [st, bad(pathFor(st.coord, to))]));
  const out: Trip[] = [];
  if (!bad(pathFor(from, to))) out.push({ legs: [], total: directM / ROLL_M_PER_MIN, walkM: directM, closures: nClosures(from, to) });
  for (const a of usable) {
    for (const b of usable) {
      if (a === b || steepFrom.get(a) || steepTo.get(b)) continue;
      const w1 = rollM(from, a.coord);
      const w2 = rollM(b.coord, to);
      const bonus = preferStopIds.has(a.stop_id) || preferStopIds.has(b.stop_id) ? -3 : 0;
      const total = w1 / ROLL_M_PER_MIN + AVG_WAIT_MIN + Math.abs(a.minute - b.minute) + w2 / ROLL_M_PER_MIN + bonus;
      out.push({ legs: [], board: a, alight: b, total, walkM: w1 + w2, closures: nClosures(from, a.coord) + nClosures(b.coord, to) });
    }
  }
  // nothing stays under the limit: fall back to every option (the leg warnings say "above your limit")
  // nothing fits: offer everything (the leg warnings say what's wrong). `relaxed` stops the recursion.
  if (!out.length && !relaxed) return candidates(from, to, opts, closures, preferStopIds, true);
  return out.sort((x, y) => x.total - y.total);
}

type Strategy = "fastest" | "fewest_closures" | "least_rolling" | "alternate" | "roll_only";
const STRATEGY_LABEL: Record<Strategy, string> = {
  fastest: "Fastest",
  fewest_closures: "Fewer construction zones",
  least_rolling: "Least rolling",
  alternate: "Other station",
  roll_only: "Roll the whole way",
};
const ROLL_ONLY_MAX_MIN = 60;

function pick(cands: Trip[], strategy: Strategy): Trip | null {
  const best = cands[0];
  if (strategy === "fastest") return best;
  if (strategy === "fewest_closures") {
    // only offered when the fastest route rolls past construction; slower, but past fewer closures
    if (!best.closures) return null;
    return cands.filter((c) => c.closures < best.closures && c.total <= best.total + 20).sort((a, b) => a.closures - b.closures || a.total - b.total)[0] ?? null;
  }
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
    const t = pick(cands, strategy) ?? (strategy === "alternate" || strategy === "fewest_closures" ? cands[0] : null);
    if (!t) return null;
    segs.push(build(t, points[i], points[i + 1], names[i + 1], opts));
  }
  return segs;
}

const chainKey = (segs: Trip[]) => segs.map((t) => `${t.board?.stop_id ?? "-"}>${t.alight?.stop_id ?? "-"}`).join("|");

function summarize(legs: Leg[]) {
  const walk_m = legs.reduce((s, l) => s + (l.mode === "walk" ? l.distance_m : 0), 0);
  const transit = legs.filter((l) => l.mode === "transit").length;
  const duration_min = legs.reduce((s, l) => s + l.duration_min, 0) + transit * AVG_WAIT_MIN; // wait for each trolley
  return { duration_min: Math.round(duration_min), walk_m: Math.round(walk_m), transfers: Math.max(0, transit - 1) };
}

function explain(normal: Trip, actual: Trip, causes: ClosureFeature[], withinSlopeLimit: boolean): string[] {
  const zones = (legs: Leg[]) =>
    new Set(legs.flatMap((l) => (l.mode === "walk" ? l.warnings.map((w) => w.message) : [])).filter((m) => m.startsWith("MTS reports construction"))).size;
  const moreConstruction = zones(actual.legs) - zones(normal.legs);
  const addedMin = summarize(actual.legs).duration_min - summarize(normal.legs).duration_min;
  const out: string[] = [];
  for (const c of causes) {
    const p = c.properties;
    out.push(
      p.kind === "elevator_outage"
        ? `${p.title.replace(/^Elevator out at /, "The elevator at ")} is out of service, so you couldn't get between the platform and the street there.`
        : p.stop_id
          ? `${p.title}, so trains can't be used there right now.`
          : `${p.title}, so the usual sidewalk there can't be used.`,
    );
    if (p.alternative) out.push(`${p.source === "mts_alerts" ? "MTS suggests" : "Suggested detour"}: "${p.alternative.replace(/[.\s]+$/, "")}."`);
  }
  if (normal.board?.stop_id !== actual.board?.stop_id && actual.board) {
    out.push(`You'll board at ${actual.board.name} instead of ${normal.board?.name ?? "walking the whole way"}.`);
  }
  if (normal.alight?.stop_id !== actual.alight?.stop_id && actual.alight) {
    out.push(`You'll get off at ${actual.alight.name} instead of ${normal.alight?.name ?? "the original stop"}.`);
  }
  if (!actual.board) out.push("No accessible trolley option fits this trip right now, so the route rolls the whole way.");
  out.push(
    addedMin > 0
      ? `The new route adds ${addedMin} min${withinSlopeLimit ? " and stays within your slope limit" : ""}.`
      : addedMin < 0
        ? `The new route is ${-addedMin} min shorter${moreConstruction > 0 ? `, but rolls past ${moreConstruction} more construction zone${moreConstruction === 1 ? "" : "s"}, which is why it wasn't recommended before` : ""}.`
        : `The new route takes about the same time${withinSlopeLimit ? " and stays within your slope limit" : ""}.`,
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

  const legsOf = (segs: Trip[]) => segs.flatMap((t) => t.legs);

  /** All distinct options for a set of closures, plus which one SafeRoute recommends. */
  const buildOptions = (closureSet: ClosureFeature[], preferSet: Set<string>) => {
    const raw: { strategy: Strategy; segs: Trip[] }[] = [];
    const seen = new Set<string>();
    for (const strategy of ["fastest", "fewest_closures", "least_rolling", "alternate", "roll_only"] as Strategy[]) {
      const segs = planChain(points, names, opts, closureSet, preferSet, strategy);
      if (!segs || seen.has(chainKey(segs))) continue;
      seen.add(chainKey(segs));
      raw.push({ strategy, segs });
    }
    const list = raw.map((o, i) => {
      const legs = legsOf(o.segs);
      let label = STRATEGY_LABEL[o.strategy];
      if (o.strategy === "alternate") {
        const t = o.segs.find((x, k) => x.board && chainKey([x]) !== chainKey([raw[0].segs[k]]));
        const f = raw[0].segs[o.segs.indexOf(t!)];
        if (t?.board && t.board !== f?.board) label = `Board at ${t.board.name.replace(/ Station$/, "")}`;
        else if (t?.alight) label = `Get off at ${t.alight.name.replace(/ Station$/, "")}`;
      }
      return { id: `opt_${i}_${o.strategy}`, label, summary: summarize(legs), legs, segs: o.segs };
    });
    // Recommend the best balance of time and obstacles:
    //  - each distinct real MTS construction zone rolled past costs CONSTRUCTION_COST_MIN (blocked curb + backtracking)
    //  - climbing is hard work in a manual chair: ~1 min per 10 m climbed (USGS elevation)
    const construction = (o: { legs: Leg[] }) =>
      new Set(o.legs.flatMap((l) => (l.mode === "walk" ? l.warnings.map((w) => w.message) : [])).filter((m) => m.startsWith("MTS reports construction"))).size;
    const climb = (o: { legs: Leg[] }) => o.legs.reduce((m, l) => m + (l.mode === "walk" ? slopeStats(l.geometry.coordinates).climbM : 0), 0);
    const score = (o: (typeof list)[number]) => o.summary.duration_min + construction(o) * CONSTRUCTION_COST_MIN + climb(o) / 10;
    const rec = list.reduce((best, o) => (score(o) < score(best) ? o : best), list[0]);
    const fast = list[0];
    const fewer = construction(fast) - construction(rec);
    const extra = rec.summary.duration_min - fast.summary.duration_min;
    const lessClimb = climb(fast) - climb(rec);
    const gains = [
      fewer > 0 && `rolls past ${fewer} fewer construction zone${fewer === 1 ? "" : "s"}`,
      lessClimb >= 10 && `climbs ${Math.round(lessClimb)} m less`,
    ].filter(Boolean) as string[];
    const reason =
      rec === fast
        ? construction(fast)
          ? "Fastest route, and no other option avoids more construction"
          : "Fastest route, with no construction on the way"
        : gains.length
          ? `${gains.join(" and ").replace(/^./, (c) => c.toUpperCase())} than the fastest route, for ${extra} more min`
          : `Best balance of time and obstacles (${extra} min slower than the fastest)`;
    return { list, rec, reason };
  };

  const actual = buildOptions(closures, prefer);
  // the same trip with no MTS outage alerts (real construction closures and hazards still apply)
  const normal = buildOptions([...BASE_CLOSURES, ...REAL_MTS_CLOSURES], new Set());

  // Rerouted if an ingested outage blocks a station the recommended no-outage route would have used
  const blocked = blockedStopIds(closures);
  const normalStops = new Set(normal.rec.segs.flatMap((t) => [t.board?.stop_id, t.alight?.stop_id]).filter(Boolean) as string[]);
  const normalRolls = normal.rec.legs.filter((l) => l.mode === "walk").map((l) => l.geometry.coordinates);
  const causes = [...ingested.values()]
    .map((v) => v.closure)
    .filter((c) =>
      c.properties.stop_id
        ? blocked.has(c.properties.stop_id) && normalStops.has(c.properties.stop_id)
        : c.properties.severity === "blocking" && normalRolls.some((r) => passesBlock(r, [c])),
    );
  const causeStops = new Set(causes.map((c) => c.properties.stop_id));
  const usesCause = (t: Trip) => causeStops.has(t.board?.stop_id ?? "") || causeStops.has(t.alight?.stop_id ?? "");
  const firstChanged = actual.rec.segs.findIndex((t, i) => chainKey([t]) !== chainKey([normal.rec.segs[i]]));
  const causeIdx = normal.rec.segs.findIndex((t, i) => usesCause(t) && chainKey([t]) !== chainKey([actual.rec.segs[i]]));
  const changedIdx = causeIdx >= 0 ? causeIdx : firstChanged;
  const rerouted = changedIdx >= 0 && causes.length > 0;

  // every option avoids the stations blocked by these outages (blocked stations are never used)
  const avoided = rerouted ? causes.map((c) => c.properties.id) : [];
  const outageNames = causes.map((c) => c.properties.title.replace(/^Elevator out at /, "the elevator outage at ").replace(/ (Station )?closed$/i, " closure"));
  const recReason = rerouted
    ? `Avoids ${outageNames.join(" and ")}. ${actual.reason.replace(/^./, (c) => c.toUpperCase())}`
    : actual.reason;
  const routeOptions: RouteOption[] = actual.list.map(({ segs: _segs, ...o }) => ({
    ...o,
    avoided_closure_ids: avoided,
    ...(o.id === actual.rec.id ? { recommended: true, recommended_reason: recReason } : { recommended: false, recommended_reason: null }),
  }));
  const withinLimit = actual.rec.legs.every((l) => l.mode !== "walk" || slopeStats(l.geometry.coordinates).avgGrade <= opts.max_grade);

  return {
    mode,
    parsed_request: parsed,
    summary: routeOptions[0].summary,
    legs: routeOptions[0].legs,
    rerouted,
    reroute: rerouted
      ? {
          cause_closure_ids: causes.map((c) => c.properties.id),
          explanation: explain(
            { ...normal.rec.segs[changedIdx], legs: normal.rec.legs },
            { ...actual.rec.segs[changedIdx], legs: actual.rec.legs },
            causes,
            withinLimit,
          ),
          ai_generated: true,
          previous_legs: normal.rec.legs,
          previous_summary: normal.rec.summary,
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

/** Use a closure that the real backend (Gemini) produced, keeping the mock's routing. */
export function mockIngestClosure(closure: ClosureFeature, demoFile?: string): void {
  const known = DEMO_ALERTS.find((a) => a.file === demoFile);
  ingested.set(closure.properties.id, { closure: structuredClone(closure), alternative_stop_id: known?.alternative_stop_id ?? null });
}
