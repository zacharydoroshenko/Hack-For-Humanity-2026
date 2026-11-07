/**
 * Dummy data for the mock backend (VITE_USE_FIXTURES=1).
 *
 * Station IDs, names, and coordinates are real (MTS GTFS). Ride minutes come from
 * a real Blue Line trip. Exit grades, access types, curb ramps, hazards, and
 * alert texts are MADE UP for the demo.
 */
import type { ClosureFeature, CurbRampFeature, LngLat, StopFeature } from "@shared/types";

export type StationAccess = "elevator" | "ramp" | "level";

export interface Station {
  stop_id: string;
  name: string;
  coord: LngLat;
  /** minutes from Washington Street Station along the line (from a real GTFS trip) */
  minute: number;
  access: StationAccess;
  /** dummy: steepest sidewalk grade on the way in/out of the station */
  exitGrade: number;
}

/** Blue Line stations in the corridor, south → north. */
export const STATIONS: Station[] = [
  { stop_id: "75076", name: "Washington Street Station", coord: [-117.18447, 32.74172], minute: 0, access: "level", exitGrade: 0.02 },
  { stop_id: "75042", name: "Old Town Station", coord: [-117.19949, 32.75491], minute: 3, access: "elevator", exitGrade: 0.02 },
  { stop_id: "77771", name: "Tecolote Road Station", coord: [-117.20506, 32.76991], minute: 6, access: "ramp", exitGrade: 0.065 },
  { stop_id: "77773", name: "Clairemont Drive Station", coord: [-117.20613, 32.79006], minute: 9, access: "elevator", exitGrade: 0.075 },
  { stop_id: "77775", name: "Balboa Avenue Station", coord: [-117.21407, 32.80586], minute: 12, access: "elevator", exitGrade: 0.03 },
  { stop_id: "77778", name: "Nobel Drive Station", coord: [-117.23039, 32.86697], minute: 18, access: "ramp", exitGrade: 0.045 },
  { stop_id: "77780", name: "VA Medical Center Station", coord: [-117.22982, 32.87425], minute: 20, access: "elevator", exitGrade: 0.03 },
  { stop_id: "77782", name: "UCSD Central Campus Station", coord: [-117.23178, 32.87844], minute: 23, access: "elevator", exitGrade: 0.025 },
  { stop_id: "77784", name: "UCSD Health La Jolla Station", coord: [-117.2235, 32.88182], minute: 25, access: "elevator", exitGrade: 0.03 },
  { stop_id: "77786", name: "Executive Drive Station", coord: [-117.21405, 32.87414], minute: 27, access: "elevator", exitGrade: 0.035 },
  { stop_id: "77787", name: "UTC Station", coord: [-117.21401, 32.8692], minute: 29, access: "elevator", exitGrade: 0.02 },
];

/** Trolley track geometry between stations follows station order (good enough for a demo). */
export const BLUE_LINE_COLOR = "0000FF";
export const AVG_WAIT_MIN = 6;

export interface Place {
  name: string;
  aliases: string[];
  coord: LngLat;
}

export const PLACES: Place[] = [
  { name: "Geisel Library", aliases: ["geisel", "library"], coord: [-117.2376, 32.8811] },
  { name: "Price Center", aliases: ["price center", "pc"], coord: [-117.2372, 32.8797] },
  { name: "Jacobs Medical Center", aliases: ["jacobs", "ucsd health", "hospital"], coord: [-117.2243, 32.8786] },
  { name: "Westfield UTC", aliases: ["utc", "westfield", "mall"], coord: [-117.2106, 32.8704] },
  { name: "VA Medical Center", aliases: ["va", "veterans"], coord: [-117.2337, 32.8768] },
  { name: "Balboa Avenue Transit Center", aliases: ["balboa"], coord: [-117.2129, 32.8064] },
  { name: "Mission Bay (Clairemont Dr)", aliases: ["mission bay", "clairemont"], coord: [-117.2105, 32.7895] },
  { name: "Old Town State Historic Park", aliases: ["old town", "historic park", "old town park"], coord: [-117.1966, 32.7545] },
  { name: "Presidio Park", aliases: ["presidio"], coord: [-117.1946, 32.7588] },
  { name: "Mission Hills (Washington St)", aliases: ["mission hills", "washington st", "washington street"], coord: [-117.1845, 32.7475] },
];

const pt = (coord: LngLat) => ({ type: "Point" as const, coordinates: coord });

/** A few real bus stops in the corridor, with their real wheelchair_boarding values. */
const BUS_STOPS: StopFeature[] = [
  { stop_id: "11154", name: "Arriba St & Regents Rd", coord: [-117.22343, 32.86152] as LngLat, wb: 1 as const },
  { stop_id: "10421", name: "Balboa Av & Clairemont Dr", coord: [-117.20056, 32.81162] as LngLat, wb: 1 as const },
  { stop_id: "10045", name: "Balboa Av & Moraga Av", coord: [-117.2107, 32.80774] as LngLat, wb: 2 as const },
  { stop_id: "10386", name: "Garnet Av & Fogg St", coord: [-117.22571, 32.80345] as LngLat, wb: 2 as const },
].map((s) => ({
  type: "Feature",
  geometry: pt(s.coord),
  properties: { stop_id: s.stop_id, name: s.name, wheelchair_boarding: s.wb, is_blue_line: false, active_closure_ids: [] },
}));

export function baseStops(): StopFeature[] {
  const stations: StopFeature[] = STATIONS.map((s) => ({
    type: "Feature",
    geometry: pt(s.coord),
    // Real feed value: every Blue Line station is 0 (unknown)
    properties: { stop_id: s.stop_id, name: s.name, wheelchair_boarding: 0, is_blue_line: true, active_closure_ids: [] },
  }));
  return [...stations, ...structuredClone(BUS_STOPS)];
}

/** Dummy curb-ramp needs, placed near station exits so they show up on routes. */
export const CURB_RAMPS: CurbRampFeature[] = [
  { id: "ramp_1", coord: [-117.1872, 32.7449] as LngLat, d: "Missing curb ramp · Hancock St & Washington St (dummy)" },
  { id: "ramp_2", coord: [-117.1978, 32.7531] as LngLat, d: "Non-compliant curb ramp · Taylor St & Congress St (dummy)" },
  { id: "ramp_3", coord: [-117.2082, 32.7725] as LngLat, d: "Missing curb ramp · Morena Blvd & Tecolote Rd (dummy)" },
  { id: "ramp_4", coord: [-117.2118, 32.8049] as LngLat, d: "Missing curb ramp · Morena Blvd & Balboa Ave (dummy)" },
  { id: "ramp_5", coord: [-117.2341, 32.8801] as LngLat, d: "Non-compliant curb ramp · Library Walk & Gilman Dr (dummy)" },
  { id: "ramp_6", coord: [-117.2152, 32.8711] as LngLat, d: "Missing curb ramp · Genesee Ave & Esplanade Ct (dummy)" },
].map((r) => ({ type: "Feature", geometry: pt(r.coord), properties: { id: r.id, description: r.d } }));

/** Always-on closures (not from alerts). */
export const BASE_CLOSURES: ClosureFeature[] = [
  {
    type: "Feature",
    geometry: { type: "LineString", coordinates: [[-117.2058, 32.7712], [-117.2041, 32.7731]] },
    properties: {
      id: "c_steep_tecolote", kind: "steep_segment", severity: "warning",
      title: "Steep sidewalk (6.5% grade)", description: "Tecolote Rd east of the station climbs above the 5% comfort limit. (dummy)",
      alternative: null, stop_id: null, source: "usgs", raw_text: null, ai_generated: false,
    },
  },
  {
    type: "Feature",
    geometry: pt([-117.1869, 32.7432]),
    properties: {
      id: "c_hazard_washington", kind: "reported_hazard", severity: "warning",
      title: "Reported: uplifted sidewalk", description: "Get It Done report: sidewalk panel raised ~2 in near the station entrance. (dummy)",
      alternative: null, stop_id: null, source: "get_it_done",
      raw_text: "Sidewalk lifted by tree roots, my walker got stuck. Right by the trolley stop on Washington.",
      ai_generated: true,
    },
  },
];

export interface DemoAlert {
  file: string;
  label: string;
  closure: ClosureFeature;
  /** stop the MTS alert suggests instead */
  alternative_stop_id: string | null;
}

const alertClosure = (
  id: string, stop: Station, kind: "elevator_outage" | "stop_closure", title: string,
  description: string, alternative: string | null, raw: string,
): ClosureFeature => ({
  type: "Feature",
  geometry: pt(stop.coord),
  properties: {
    id, kind, severity: "blocking", title, description, alternative,
    stop_id: stop.stop_id, source: "mts_alerts", raw_text: raw, ai_generated: true,
  },
});

const st = (id: string) => STATIONS.find((s) => s.stop_id === id)!;

/** The frontend's list of demo alerts. Keep filenames in sync with data/demo_alerts/. */
export const DEMO_ALERTS: DemoAlert[] = [
  {
    file: "old_town_elevator.json",
    label: "Old Town elevator out",
    alternative_stop_id: "75076",
    closure: alertClosure(
      "c_alert_oldtown_elev", st("75042"), "elevator_outage",
      "Elevator out at Old Town Station",
      "The elevator between the trolley platform and street level is out of service.",
      "Use Washington Street Station",
      "ELEVATOR OUTAGE: Old Town Transit Center elevator is temporarily out of service. Customers requiring elevator access should use Washington St Station. We apologize for the inconvenience. (dummy alert)",
    ),
  },
  {
    file: "ucsd_central_elevator.json",
    label: "UCSD Central Campus elevator out",
    alternative_stop_id: "77780",
    closure: alertClosure(
      "c_alert_ucsd_elev", st("77782"), "elevator_outage",
      "Elevator out at UCSD Central Campus",
      "Both platform elevators at UC San Diego Central Campus Station are out of service.",
      "Use VA Medical Center Station",
      "UC San Diego Central Campus Stn - elevators out of service until further notice. Riders needing elevators pls use VA Medical Center Stn. (dummy alert)",
    ),
  },
  {
    file: "balboa_closure.json",
    label: "Balboa Ave platform closed",
    alternative_stop_id: null,
    closure: alertClosure(
      "c_alert_balboa_closed", st("77775"), "stop_closure",
      "Balboa Avenue Station platform closed",
      "Southbound platform closed for maintenance; trains will not stop.",
      null,
      "Balboa Ave Station: SB platform closed for track work 9am-6pm today. Trains will pass through without stopping. (dummy alert)",
    ),
  },
];
