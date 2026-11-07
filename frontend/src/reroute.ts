/** Compare the usual route (before outages) with a new one, to explain what an outage changed. */
import type { ClosureFeature, Leg, LngLat, TransitLeg } from "./api/client";

const key = (l: Leg) => `${l.mode}:${JSON.stringify(l.geometry.coordinates)}`;
const short = (n: string) => n.replace(/ Station$/, "");

/** Indices of legs in `legs` that the usual route didn't have. */
export function changedLegIndices(legs: Leg[], previous: Leg[] | undefined): Set<number> {
  if (!previous) return new Set();
  const before = new Set(previous.map(key));
  return new Set(legs.map((l, i) => (before.has(key(l)) ? -1 : i)).filter((i) => i >= 0));
}

/**
 * Pieces of the usual route that the new one no longer uses (drawn as "blocked" on the map).
 * Shared track is left out, so only the abandoned part shows, e.g. the stretch from the blocked station.
 */
export function droppedPaths(legs: Leg[], previous: Leg[] | undefined): LngLat[][] {
  if (!previous) return [];
  const now = new Set(legs.map(key));
  const used = new Set(legs.flatMap((l) => l.geometry.coordinates.map((c) => c.join(","))));
  const out: LngLat[][] = [];
  for (const l of previous) {
    if (now.has(key(l))) continue;
    const pts = l.geometry.coordinates;
    let run: LngLat[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const shared = used.has(pts[i].join(",")) && used.has(pts[i + 1].join(","));
      if (shared) {
        if (run.length > 1) out.push(run);
        run = [];
      } else {
        if (!run.length) run.push(pts[i]);
        run.push(pts[i + 1]);
      }
    }
    if (run.length > 1) out.push(run);
  }
  return out;
}

export interface StationChange {
  what: "Board at" | "Get off at";
  before: string;
  after: string;
  /** the usual station is blocked by one of these outages */
  blockedBy: ClosureFeature | null;
}

/** "Board at UCSD Central Campus → VA Medical Center", ride by ride. */
export function stationChanges(legs: Leg[], previous: Leg[] | undefined, causes: ClosureFeature[]): StationChange[] {
  if (!previous) return [];
  const rides = (ls: Leg[]) => ls.filter((l): l is TransitLeg => l.mode === "transit");
  const now = rides(legs);
  const was = rides(previous);
  const blocker = (stopId: string) => causes.find((c) => c.properties.stop_id === stopId) ?? null;
  const out: StationChange[] = [];
  for (let i = 0; i < Math.min(now.length, was.length); i++) {
    if (now[i].from_stop.stop_id !== was[i].from_stop.stop_id)
      out.push({ what: "Board at", before: short(was[i].from_stop.name), after: short(now[i].from_stop.name), blockedBy: blocker(was[i].from_stop.stop_id) });
    if (now[i].to_stop.stop_id !== was[i].to_stop.stop_id)
      out.push({ what: "Get off at", before: short(was[i].to_stop.name), after: short(now[i].to_stop.name), blockedBy: blocker(was[i].to_stop.stop_id) });
  }
  return out;
}

/** Short human name for an outage, e.g. "UCSD Central Campus elevator out". */
export function outageName(c: ClosureFeature): string {
  const t = c.properties.title;
  const m = t.match(/^Elevator out at (.+?)( Station)?$/i);
  if (m) return `${m[1]} elevator out`;
  return t.replace(/ Station closed$/i, " closed");
}
