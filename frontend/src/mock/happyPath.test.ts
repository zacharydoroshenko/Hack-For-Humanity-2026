/**
 * Happy path, run against the mock backend:  npm test
 *
 *   1. Load layers → no MTS outages yet
 *   2. Plan "Manual wheelchair, Geisel Library to Old Town…" → walk · Blue Line · walk,
 *      boarding at UCSD Central Campus
 *   3. Replay the "UCSD Central Campus elevator out" alert
 *   4. Layers show the outage on that station
 *   5. Re-plan → rerouted via VA Medical Center, with an explanation
 *   6. Reset → back to the original route
 *
 * Also checks that every mock response matches the frozen contract's shape.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { PlanResponse, TransitLeg } from "@shared/types";
import { HAPPY_PATH, PLACES } from "../demoConfig";
import { mockIngest, mockLayers, mockPlan, resetMock } from "./server";

const req = { from: HAPPY_PATH.from.coord, to: HAPPY_PATH.to.coord, max_grade: HAPPY_PATH.maxGrade };
const transit = (r: PlanResponse) => r.legs.find((l): l is TransitLeg => l.mode === "transit");

function expectContractShape(r: PlanResponse) {
  expect(Object.keys(r).filter((k) => k !== "options").sort()).toEqual(["legs", "mode", "parsed_request", "reroute", "rerouted", "summary"]);
  for (const leg of r.legs) {
    expect(leg.geometry.type).toBe("LineString");
    expect(leg.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
    for (const [lon, lat] of leg.geometry.coordinates) {
      expect(lon).toBeLessThan(-117); // [lon, lat] order, San Diego
      expect(lat).toBeGreaterThan(32);
    }
  }
}

describe("happy path (mock backend)", () => {
  beforeEach(resetMock);

  it("plans, reroutes around an elevator outage, and resets", () => {
    // 1. layers
    const before = mockLayers();
    expect(before.closures.features.some((c) => c.properties.source === "mts_alerts")).toBe(false);
    expect(before.stops.features.length).toBeGreaterThan(10);

    // 2. plan
    const normal = mockPlan(req);
    expectContractShape(normal);
    expect(normal.mode).toBe("transit");
    expect(normal.legs.map((l) => l.mode)).toEqual(["walk", "transit", "walk"]);
    expect(transit(normal)!.from_stop.name).toBe("UCSD Central Campus Station");
    expect(transit(normal)!.to_stop.name).toBe("Old Town Station");
    expect(normal.rerouted).toBe(false);

    // 3. alert
    const { closure } = mockIngest({ demo_file: "ucsd_central_elevator.json" });
    expect(closure.properties).toMatchObject({ kind: "elevator_outage", severity: "blocking", stop_id: "77782", ai_generated: true });

    // 4. layers reflect it
    const after = mockLayers();
    const ucsd = after.stops.features.find((s) => s.properties.stop_id === "77782")!;
    expect(ucsd.properties.active_closure_ids).toEqual([closure.properties.id]);

    // 5. reroute
    const rerouted = mockPlan(req);
    expectContractShape(rerouted);
    expect(rerouted.rerouted).toBe(true);
    expect(transit(rerouted)!.from_stop.name).toBe("VA Medical Center Station");
    expect(rerouted.reroute!.cause_closure_ids).toEqual([closure.properties.id]);
    expect(rerouted.reroute!.explanation.join(" ")).toMatch(/VA Medical Center/);
    const added = rerouted.summary.duration_min - normal.summary.duration_min;
    expect(rerouted.reroute!.explanation.join(" ")).toContain(`adds ${added} min`);

    // 6. reset
    resetMock();
    expect(transit(mockPlan(req))!.from_stop.name).toBe("UCSD Central Campus Station");
  });

  it("Old Town elevator outage moves the alight stop to Washington Street", () => {
    mockIngest({ demo_file: "old_town_elevator.json" });
    const r = mockPlan(req);
    expect(r.rerouted).toBe(true);
    expect(transit(r)!.to_stop.name).toBe("Washington Street Station");
  });

  it("steep stations are skipped for a manual chair but allowed for a power chair", () => {
    const toTecolote = { from: HAPPY_PATH.from.coord, to: [-117.2045, 32.7712] as [number, number] };
    const manual = mockPlan({ ...toTecolote, max_grade: 0.04 });
    const power = mockPlan({ ...toTecolote, max_grade: 0.0833 });
    expect(transit(manual)!.to_stop.name).not.toBe("Tecolote Road Station");
    expect(transit(power)!.to_stop.name).toBe("Tecolote Road Station");
  });

  it("rideshare, drive and roll options return car / roll legs", () => {
    const ride = mockPlan({ ...req, mode: "rideshare" });
    const drive = mockPlan({ ...req, mode: "drive" });
    const roll = mockPlan({ ...req, mode: "walk" });
    for (const r of [ride, drive, roll]) expectContractShape(r);
    expect(ride.legs[0]).toMatchObject({ mode: "rideshare" });
    expect(ride.legs[0].mode === "rideshare" && ride.legs[0].note).toMatch(/wheelchair-accessible vehicle/);
    expect(drive.legs[0]).toMatchObject({ mode: "drive" });
    expect(roll.legs.map((l) => l.mode)).toEqual(["walk"]);
    // outages only affect transit
    mockIngest({ demo_file: "ucsd_central_elevator.json" });
    expect(mockPlan({ ...req, mode: "rideshare" }).rerouted).toBe(false);
  });

  it("a nearby destination is a roll-only route with no trolley", () => {
    const pc = PLACES.find((p) => p.name === "Price Center")!;
    const r = mockPlan({ from: HAPPY_PATH.from.coord, to: pc.coord });
    expect(r.legs.map((l) => l.mode)).toEqual(["walk"]);
  });

  it("returns several distinct route options, best first, mirroring the top-level route", () => {
    const r = mockPlan(req);
    expect(r.options!.length).toBeGreaterThanOrEqual(2);
    expect(r.options![0].legs).toEqual(r.legs);
    expect(r.options![0].label).toBe("Fastest");
    const keys = r.options!.map((o) => JSON.stringify(o.legs.map((l) => (l.mode === "transit" ? l.from_stop.stop_id + l.to_stop.stop_id : l.mode))));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("visits intermediate stops in order", () => {
    const pc = PLACES.find((p) => p.name === "Price Center")!;
    const r = mockPlan({ ...req, via: [pc.coord] });
    const first = r.legs[0];
    expect(first.mode).toBe("walk");
    // first segment: Geisel -> Price Center is a short roll ending at the stop
    const end = first.geometry.coordinates[first.geometry.coordinates.length - 1];
    expect(end).toEqual(pc.coord);
    expect(transit(r)!.to_stop.name).toBe("Old Town Station");
  });

  it("still offers route options when the trip has an intermediate stop", () => {
    const balboa = PLACES.find((p) => p.name === "Balboa Avenue Transit Center")!;
    const r = mockPlan({ ...req, via: [balboa.coord] });
    expect(r.options!.length).toBeGreaterThanOrEqual(2);
  });

  it("errors clearly when no start/destination can be found", () => {
    expect(() => mockPlan({ text: "somewhere nice" })).toThrow(/start and destination/);
  });
});
