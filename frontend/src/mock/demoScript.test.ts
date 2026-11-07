/**
 * Locks in the facts DEMO.md relies on. If this fails, update DEMO.md.
 * Trip: Price Center Theater -> Old Town -> Balboa Park -> USS Midway, manual chair (4%).
 */
import { beforeEach, expect, it } from "vitest";
import type { PlanResponse, RouteOption, TransitLeg } from "@shared/types";
import { DEMO_TRIP } from "../demoConfig";
import { mockIngest, mockPlan, resetMock } from "./server";

const req = { from: DEMO_TRIP.from.coord, via: DEMO_TRIP.via.map((v) => v.coord), to: DEMO_TRIP.to.coord, max_grade: DEMO_TRIP.maxGrade };
const rides = (o: { legs: RouteOption["legs"] }) => o.legs.filter((l): l is TransitLeg => l.mode === "transit").map((l) => `${l.from_stop.name} > ${l.to_stop.name}`);
const notes = (o: { legs: RouteOption["legs"] }) => o.legs.flatMap((l) => ("warnings" in l ? l.warnings.map((w) => w.message) : []));
const opt = (r: PlanResponse, label: string) => r.options!.find((o) => o.label === label)!;

beforeEach(resetMock);

it("act 1: fastest route rolls past two real MTS construction closures and climbs more; the recommended one avoids one", () => {
  const r = mockPlan(req);
  const fastest = r.options![0];
  const fewer = opt(r, "Fewer construction zones");
  expect(fastest.label).toBe("Fastest");
  expect(rides(fastest)).toContain("Old Town Station > Middletown Station");
  expect(notes(fastest).filter((n) => n.includes("State St & Kalmia St")).length).toBeGreaterThan(0);
  expect(notes(fastest).filter((n) => n.includes("First Av & Laurel St")).length).toBeGreaterThan(0);
  expect(rides(fewer)).toContain("Old Town Station > County Center/Little Italy Station");
  expect(notes(fewer).some((n) => n.includes("State St & Kalmia St"))).toBe(false);
  expect(fewer.summary.duration_min - fastest.summary.duration_min).toBe(16);
  // SafeRoute recommends the slower, construction-avoiding route
  expect(fewer.recommended).toBe(true);
  expect(fastest.recommended).toBe(false);
  expect(fewer.recommended_reason).toBe("Rolls past 1 fewer construction zone and climbs 83 m less than the fastest route, for 16 more min");
  expect(r.options!.filter((o) => o.recommended)).toHaveLength(1);
});

it("act 2: the fake UCSD Central Campus elevator alert moves boarding to VA Medical Center", () => {
  const before = mockPlan(req);
  expect(rides(before.options![0])[0]).toBe("UCSD Central Campus Station > Old Town Station");
  mockIngest({ demo_file: "ucsd_central_elevator.json" });
  const after = mockPlan(req);
  expect(after.rerouted).toBe(true);
  expect(rides(after.options![0])[0]).toBe("VA Medical Center Station > Old Town Station");
  expect(after.reroute!.explanation.join(" ")).toMatch(/adds 9 min/);
  // the construction-avoiding option survives the reroute
  expect(rides(opt(after, "Fewer construction zones"))).toContain("Old Town Station > County Center/Little Italy Station");
});

it("hotkey 2: closing County Center/Little Italy breaks the recommended route and explains the trade-off", () => {
  mockIngest({ demo_file: "county_center_closed.json" });
  const r = mockPlan(req);
  expect(r.rerouted).toBe(true);
  const rec = r.options!.find((o) => o.recommended)!;
  expect(rides(rec).some((x) => x.includes("County Center"))).toBe(false);
  expect(r.reroute!.explanation.join(" ")).toMatch(/rolls past 1 more construction zone/);
});

it("hotkey 3: closing Santa Fe Depot changes the leg to the USS Midway", () => {
  mockIngest({ demo_file: "santa_fe_depot_closed.json" });
  const r = mockPlan(req);
  expect(r.rerouted).toBe(true);
  const rec = r.options!.find((o) => o.recommended)!;
  expect(rides(rec).some((x) => x.includes("Santa Fe Depot"))).toBe(false);
});

it("hotkeys 1 then 4: UCSD Central and VA Medical Center both out, so board at UCSD Health La Jolla", () => {
  mockIngest({ demo_file: "ucsd_central_elevator.json" });
  mockIngest({ demo_file: "va_medical_elevator.json" });
  const r = mockPlan(req);
  const rec = r.options!.find((o) => o.recommended)!;
  expect(rides(rec)[0]).toBe("UCSD Health La Jolla Station > Old Town Station");
});

it("every kind of problem shows up on the demo trip, all from real data except the simulated outage", () => {
  mockIngest({ demo_file: "ucsd_central_elevator.json" });
  const r = mockPlan(req);
  const all = r.options!.flatMap((o) => notes(o));
  expect(all.some((n) => n.startsWith("MTS reports construction"))).toBe(true); // real MTS stop closures
  expect(all.some((n) => n.startsWith("Detour for curb ramps"))).toBe(true); // real City curb-ramp layer
  expect(all.some((n) => n.startsWith("Reported:"))).toBe(true); // real Get It Done reports
  expect(all.some((n) => n.startsWith("Steep street:") || n.startsWith("Climbs"))).toBe(true); // real USGS slope
  expect(r.rerouted).toBe(true); // simulated elevator outage
});

it("reroutes say which outage caused them: usual route, avoided outage, and what changed", async () => {
  const { stationChanges, outageName } = await import("../reroute");
  mockIngest({ demo_file: "ucsd_central_elevator.json" });
  const r = mockPlan(req);
  const rec = r.options!.find((o) => o.recommended)!;
  expect(r.reroute!.previous_legs!.length).toBeGreaterThan(0);
  expect(r.options!.every((o) => o.avoided_closure_ids!.includes("c_alert_ucsd_elev"))).toBe(true);
  expect(rec.recommended_reason).toMatch(/^Avoids the elevator outage at UCSD Central Campus\. /);
  const { DEMO_ALERTS } = await import("./data");
  const cause = DEMO_ALERTS[0].closure;
  expect(outageName(cause)).toBe("UCSD Central Campus elevator out");
  const changes = stationChanges(rec.legs, r.reroute!.previous_legs, [cause]);
  expect(changes[0]).toMatchObject({ what: "Board at", before: "UCSD Central Campus", after: "VA Medical Center" });
  expect(changes[0].blockedBy?.properties.id).toBe("c_alert_ucsd_elev");
});

it("encore: alert 2 after alert 1 names both outages and shows both station changes", async () => {
  const { stationChanges } = await import("../reroute");
  const { DEMO_ALERTS } = await import("./data");
  mockIngest({ demo_file: "ucsd_central_elevator.json" });
  mockIngest({ demo_file: "county_center_closed.json" });
  const r = mockPlan(req);
  expect([...r.reroute!.cause_closure_ids].sort()).toEqual(["c_alert_county_center", "c_alert_ucsd_elev"]);
  const rec = r.options!.find((o) => o.recommended)!;
  const changes = stationChanges(rec.legs, r.reroute!.previous_legs, [DEMO_ALERTS[0].closure, DEMO_ALERTS[1].closure]);
  expect(changes.map((c) => `${c.what} ${c.before}>${c.after}${c.blockedBy ? "!" : ""}`)).toEqual([
    "Board at UCSD Central Campus>VA Medical Center!",
    "Get off at County Center/Little Italy>Middletown!",
    "Board at County Center/Little Italy>Middletown!", // used twice: for Balboa Park and again for the Midway
  ]);
  expect(r.reroute!.explanation.join(" ")).toMatch(/rolls past 1 more construction zone/);
});

it("hotkey 6: a fenced-off sidewalk on First Ave blocks the recommended roll and reroutes via Middletown", () => {
  mockIngest({ demo_file: "first_ave_sidewalk_closed.json" });
  const r = mockPlan(req);
  expect(r.rerouted).toBe(true);
  expect(r.reroute!.cause_closure_ids).toEqual(["c_live_first_ave_sidewalk"]);
  expect(r.reroute!.explanation[0]).toMatch(/Sidewalk closed on First Ave.*can't be used/);
  const rec = r.options!.find((o) => o.recommended)!;
  expect(rides(rec)).toContain("Old Town Station > Middletown Station");
});

it("hotkey 7: a torn-out curb ramp every route passes shows as a live note without rerouting", () => {
  mockIngest({ demo_file: "laurel_5th_curb_ramp.json" });
  const r = mockPlan(req);
  expect(r.rerouted).toBe(false);
  expect(notes(r.options!.find((o) => o.recommended)!).some((n) => n.startsWith("Live: Curb ramp torn out at Laurel St & 5th Ave"))).toBe(true);
});
