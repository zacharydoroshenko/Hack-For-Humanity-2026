/**
 * Data for the in-browser demo backend (VITE_USE_FIXTURES=1).
 *
 * REAL: station IDs/names/coordinates and ride minutes (MTS GTFS), curb-ramp needs (City of San Diego ADA layer),
 * Get It Done sidewalk reports (City open data, open requests as of 2026-11-07), construction stop closures
 * (MTS alerts feed, 2026-11-07), elevation (USGS 3DEP via AWS Terrain Tiles). Rebuild with scripts/build_demo_data.py.
 * SIMULATED: the DEMO_ALERTS outage messages (triggered by hotkeys).
 */
import type { ClosureFeature, CurbRampFeature, LngLat, StopFeature } from "@shared/types";
import rampsJson from "./real/curb_ramps.json";
import gidJson from "./real/get_it_done.json";
import { slopeStats } from "./terrain";

export type StationAccess = "elevator" | "ramp" | "level";

export interface Station {
  stop_id: string;
  name: string;
  coord: LngLat;
  /** minutes from Washington Street Station along the line (from a real GTFS trip) */
  minute: number;
  access: StationAccess;
}

/** Blue Line stations in the corridor, south → north. */
export const STATIONS: Station[] = [
  // rest of the Blue Line, San Ysidro to America Plaza (real GTFS stops & ride times from the same trip)
  { stop_id: "75000", name: "San Ysidro Station", coord: [-117.02954, 32.54457], minute: -54, access: "level" },
  { stop_id: "75002", name: "Beyer Blvd Station", coord: [-117.04706, 32.55766], minute: -50, access: "level" },
  { stop_id: "75004", name: "Iris Avenue Station", coord: [-117.06718, 32.56976], minute: -47, access: "level" },
  { stop_id: "75006", name: "Palm Avenue Station", coord: [-117.08375, 32.58478], minute: -44, access: "level" },
  { stop_id: "75008", name: "Palomar Street Station", coord: [-117.08508, 32.60329], minute: -42, access: "level" },
  { stop_id: "75010", name: "H Street Station", coord: [-117.09558, 32.63018], minute: -38, access: "level" },
  { stop_id: "75012", name: "E Street Station", coord: [-117.09906, 32.6391], minute: -36, access: "level" },
  { stop_id: "75014", name: "24th Street Station", coord: [-117.10801, 32.66196], minute: -33, access: "level" },
  { stop_id: "75016", name: "8th Street Station", coord: [-117.1131, 32.67502], minute: -30, access: "level" },
  { stop_id: "75106", name: "Pacific Fleet Station", coord: [-117.12479, 32.6861], minute: -28, access: "level" },
  { stop_id: "75104", name: "Harborside Station", coord: [-117.13286, 32.69133], minute: -26, access: "level" },
  { stop_id: "75018", name: "Barrio Logan Station", coord: [-117.14667, 32.69813], minute: -24, access: "level" },
  { stop_id: "75102", name: "12th & Imperial Station", coord: [-117.15322, 32.70587], minute: -20, access: "level" },
  { stop_id: "75092", name: "Park & Market Station", coord: [-117.15372, 32.71106], minute: -18, access: "level" },
  { stop_id: "75090", name: "City College Station", coord: [-117.15417, 32.71629], minute: -15, access: "level" },
  { stop_id: "75088", name: "Fifth Avenue Station", coord: [-117.15968, 32.71679], minute: -13, access: "level" },
  { stop_id: "75087", name: "Civic Center Station", coord: [-117.16243, 32.71677], minute: -11, access: "level" },
  { stop_id: "75085", name: "America Plaza Station", coord: [-117.16881, 32.71663], minute: -9, access: "level" },
  // downtown (real GTFS stops & ride times from the same Blue Line trip)
  { stop_id: "75083", name: "Santa Fe Depot", coord: [-117.16978, 32.71732], minute: -6, access: "level" },
  { stop_id: "75080", name: "County Center/Little Italy Station", coord: [-117.1699, 32.72149], minute: -4, access: "level" },
  { stop_id: "75078", name: "Middletown Station", coord: [-117.17492, 32.73379], minute: -2, access: "level" },
  { stop_id: "75076", name: "Washington Street Station", coord: [-117.18447, 32.74172], minute: 0, access: "level" },
  { stop_id: "75042", name: "Old Town Station", coord: [-117.19949, 32.75491], minute: 3, access: "elevator" },
  { stop_id: "77771", name: "Tecolote Road Station", coord: [-117.20506, 32.76991], minute: 6, access: "ramp" },
  { stop_id: "77773", name: "Clairemont Drive Station", coord: [-117.20613, 32.79006], minute: 9, access: "elevator" },
  { stop_id: "77775", name: "Balboa Avenue Station", coord: [-117.21407, 32.80586], minute: 12, access: "elevator" },
  { stop_id: "77778", name: "Nobel Drive Station", coord: [-117.23039, 32.86697], minute: 18, access: "ramp" },
  { stop_id: "77780", name: "VA Medical Center Station", coord: [-117.22982, 32.87425], minute: 20, access: "elevator" },
  { stop_id: "77782", name: "UCSD Central Campus Station", coord: [-117.23178, 32.87844], minute: 23, access: "elevator" },
  { stop_id: "77784", name: "UCSD Health La Jolla Station", coord: [-117.2235, 32.88182], minute: 25, access: "elevator" },
  { stop_id: "77786", name: "Executive Drive Station", coord: [-117.21405, 32.87414], minute: 27, access: "elevator" },
  { stop_id: "77787", name: "UTC Station", coord: [-117.21401, 32.8692], minute: 29, access: "elevator" },
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
  { name: "Price Center Theater", aliases: ["price center theater", "pc theater", "theater"], coord: [-117.2374, 32.88] },
  { name: "Piazza della Famiglia (Little Italy)", aliases: ["little italy", "piazza della famiglia", "piazza"], coord: [-117.1687, 32.7228] },
  { name: "Balboa Park (Laurel St entrance)", aliases: ["balboa park", "laurel st", "museums"], coord: [-117.1593, 32.7314] },
  { name: "USS Midway Museum", aliases: ["uss midway", "midway"], coord: [-117.1751, 32.7137] },
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

/** REAL: intersections with missing or non-compliant curb ramps (City of San Diego, Mobility Element streets). */
interface RampRec { id: string; name: string; missing: number; noncompliant: number; total: number; coord: LngLat }
/** "Laurel St & 05Th Av" -> "Laurel St & 5th Av" */
const tidyStreet = (n: string) =>
  n
    .replace(/\b0(\d)/g, "$1")
    .replace(/(\d)(St|Nd|Rd|Th)\b/g, (_, d, sfx) => d + sfx.toLowerCase())
    .replace(/\b(Nb|Sb|Eb|Wb)\b/g, (m) => m.toUpperCase())
    .replace(/\bOff Ra\b/g, "off-ramp")
    .replace(/\bOn Ra\b/g, "on-ramp");
/** Reports typed in ALL CAPS read as shouting; show them in sentence case. */
const sentence = (t: string) => (t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t);
export const CURB_RAMPS: CurbRampFeature[] = (rampsJson as RampRec[]).map((r) => ({
  type: "Feature",
  geometry: pt(r.coord),
  properties: {
    id: r.id,
    description: `${tidyStreet(r.name)}: ${[r.missing && `${r.missing} missing`, r.noncompliant && `${r.noncompliant} non-compliant`].filter(Boolean).join(", ")} curb ramp${r.missing + r.noncompliant === 1 ? "" : "s"}`,
  },
}));

/**
 * REAL closures from the live MTS alerts feed (snapshot: data/demo_alerts/live_feed_2026-11-07.txt).
 * Bus-stop closures for construction usually mean a blocked curb or sidewalk, so the planner treats
 * them as warnings and prefers routes that don't roll past them.
 */
export const REAL_MTS_CLOSURES: ClosureFeature[] = [
  {
    type: "Feature",
    geometry: pt([-117.18121, 32.74348]),
    properties: {
      id: "mts_live_13356", kind: "stop_closure", severity: "warning",
      title: "Construction: Washington St & India St",
      description: "Uptown Bikeways construction. Westbound Route 10 stop #13356 closed until 12/31/26.",
      alternative: "Use Washington St & Trolley Tracks (#99373)", stop_id: null, source: "mts_alerts",
      raw_text: "Due to the Uptown Bikeways Project, the westbound route 10 bus stop located at Washington St & India St (#13356) will be temporarily closed 03/01/26 - 12/31/26 (24/7). Passengers are advised to catch the westbound route 10 at Washington St & Trolley Tracks (#99373)",
      ai_generated: false,
    },
  },
  {
    type: "Feature",
    geometry: pt([-117.16905, 32.73017]),
    properties: {
      id: "mts_live_12737", kind: "stop_closure", severity: "warning",
      title: "Construction: State St & Kalmia St",
      description: "State Street construction. Stop at State & Kalmia closed.",
      alternative: "Use State St & Maple St (#12731)", stop_id: null, source: "mts_alerts",
      raw_text: "Due to construction on State Street we are unable to service stop # 12373 at State and Kalmia. Passengers are advised to board bus at Stop # 12731 @ State and Maple",
      ai_generated: false,
    },
  },
  {
    type: "Feature",
    geometry: pt([-117.16399, 32.73114]),
    properties: {
      id: "mts_live_12014", kind: "stop_closure", severity: "warning",
      title: "Construction: First Av & Laurel St",
      description: "Westbound Route 11 stop #12014 closed until 12/31/2028.",
      alternative: "Use First St & Juniper St (#11636)", stop_id: null, source: "mts_alerts",
      raw_text: "Due to construction, the westbound route 11 bus stop located at First Av & Laurel St (#12014), will be closed till 12/31/2028. Passengers are advised to catch the route 11 at First St & Juniper St (#11636)",
      ai_generated: false,
    },
  },
];

/** REAL: open Get It Done "Sidewalk Repair Issue" reports near the demo route (City of San Diego open data). */
interface GidRec { id: string; date: string; detail: string; address: string; desc: string; coord: LngLat }
export const GET_IT_DONE: ClosureFeature[] = (gidJson as GidRec[]).map((r) => ({
  type: "Feature",
  geometry: pt(r.coord),
  properties: {
    id: `gid_${r.id}`, kind: "reported_hazard", severity: "warning",
    title: `Reported: ${r.desc ? sentence(r.desc.split(/[.!?]/)[0].trim()).slice(0, 60) : r.detail.toLowerCase()}`,
    description: `${r.address} · Get It Done #${r.id}, reported ${r.date}`,
    alternative: null, stop_id: null, source: "get_it_done", raw_text: r.desc ? sentence(r.desc) : null, ai_generated: false,
  },
}));

/** REAL streets (straight runs) whose grade comes from USGS elevation. Only kept if steeper than 5%. */
// endpoints are real MTS bus-stop locations on each street, so the alignment is accurate
const STEEP_STREET_CANDIDATES: { name: string; path: LngLat[] }[] = [
  { name: "Laurel St, State St to First Ave", path: [[-117.16905, 32.73114], [-117.16399, 32.73114]] },
  { name: "Laurel St, First Ave to Sixth Ave", path: [[-117.16399, 32.73114], [-117.1593, 32.7314]] },
  { name: "Washington St, trolley tracks to India St", path: [[-117.18372, 32.74154], [-117.18121, 32.74348]] },
];
export const STEEP_STREETS: ClosureFeature[] = STEEP_STREET_CANDIDATES.flatMap(({ name, path }) => {
  const st = slopeStats(path);
  if (st.avgGrade < 0.05) return [];
  return [{
    type: "Feature" as const,
    geometry: { type: "LineString" as const, coordinates: path },
    properties: {
      id: `steep_${name.replace(/\W+/g, "_").toLowerCase()}`, kind: "steep_segment" as const, severity: "warning" as const,
      title: `Steep: ${name} (${(st.avgGrade * 100).toFixed(1)}%)`,
      description: `Climbs ${st.climbM} m over ${st.lengthM} m (USGS elevation).`,
      alternative: null, stop_id: null, source: "usgs" as const, raw_text: null, ai_generated: false,
    },
  }];
});

/** Always-on closures (not from alerts). */
export const BASE_CLOSURES: ClosureFeature[] = [...GET_IT_DONE, ...STEEP_STREETS];

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

/**
 * SIMULATED live events for the demo, in hotkey order (1, 2, 3, ...): MTS elevator outages and platform
 * closures, a blocked sidewalk (Get It Done), and a torn-out curb ramp (City).
 * Keep filenames in sync with data/demo_alerts/ (the live backend sends the same text to Gemini).
 */
export const DEMO_ALERTS: DemoAlert[] = [
  {
    file: "ucsd_central_elevator.json",
    label: "UCSD Central Campus elevators out",
    alternative_stop_id: "77780",
    closure: alertClosure(
      "c_alert_ucsd_elev", st("77782"), "elevator_outage",
      "Elevator out at UCSD Central Campus",
      "Both platform elevators at UC San Diego Central Campus Station are out of service.",
      "Use VA Medical Center Station",
      "UC San Diego Central Campus Stn - elevators out of service until further notice. Riders needing elevators pls use VA Medical Center Stn.",
    ),
  },
  {
    file: "county_center_closed.json",
    label: "County Center/Little Italy platform closed",
    alternative_stop_id: "75083",
    closure: alertClosure(
      "c_alert_county_center", st("75080"), "stop_closure",
      "County Center/Little Italy Station closed",
      "Trolley platform closed for emergency repairs; Blue Line trains will pass through without stopping.",
      "Use Santa Fe Depot",
      "BLUE LINE: County Center/Little Italy Station platform closed for emergency repairs until 8 PM. Trains will not stop. Accessible boarding available at Santa Fe Depot.",
    ),
  },
  {
    file: "america_plaza_closed.json",
    label: "America Plaza platform closed",
    alternative_stop_id: "75083",
    closure: alertClosure(
      "c_alert_america_plaza", st("75085"), "stop_closure",
      "America Plaza trolley platform closed",
      "Blue Line platform at America Plaza closed for track work.",
      "Use Santa Fe Depot",
      "America Plaza: Blue Line platform closed for track work today. Riders please use Santa Fe Depot.",
    ),
  },
  {
    file: "va_medical_elevator.json",
    label: "VA Medical Center elevator out",
    alternative_stop_id: "77784",
    closure: alertClosure(
      "c_alert_va_elev", st("77780"), "elevator_outage",
      "Elevator out at VA Medical Center Station",
      "The elevator at VA Medical Center Station is out of service.",
      "Use UCSD Health La Jolla Station",
      "VA Medical Center Station elevator out of service. Riders needing an elevator please use UC San Diego Health La Jolla Station.",
    ),
  },
  {
    file: "old_town_elevator.json",
    label: "Old Town elevator out",
    alternative_stop_id: "75076",
    closure: alertClosure(
      "c_alert_oldtown_elev", st("75042"), "elevator_outage",
      "Elevator out at Old Town Station",
      "The elevator between the trolley platform and street level is out of service.",
      "Use Washington Street Station",
      "ELEVATOR OUTAGE: Old Town Transit Center elevator is temporarily out of service. Customers requiring elevator access should use Washington St Station.",
    ),
  },
  {
    // street-level, blocking: a sidewalk closure on First Ave (on the way from County Center/Little Italy to Balboa Park)
    file: "first_ave_sidewalk_closed.json",
    label: "Sidewalk fenced off in Little Italy",
    alternative_stop_id: null,
    closure: {
      type: "Feature",
      geometry: pt([-117.162885, 32.725009]),
      properties: {
        id: "c_live_first_ave_sidewalk", kind: "reported_hazard", severity: "blocking",
        title: "Sidewalk fenced off in Little Italy (near Cedar St)",
        description: "Emergency utility work. Both sidewalks fenced off; no accessible detour on this block.",
        alternative: "Use Front St or Second Ave", stop_id: null, source: "get_it_done",
        raw_text: "Water main break near Cedar St. Crews have fenced off both sidewalks, people in wheelchairs are going into the street to get around it.",
        ai_generated: true,
      },
    },
  },
  {
    // street-level, warning: a curb ramp torn out at the Balboa Park end of Laurel St (every route passes it)
    file: "laurel_5th_curb_ramp.json",
    label: "Curb ramp torn out at Laurel St & 5th Ave",
    alternative_stop_id: null,
    closure: {
      type: "Feature",
      geometry: pt([-117.1605, 32.7313]),
      properties: {
        id: "c_live_laurel_5th_ramp", kind: "missing_curb_ramp", severity: "warning",
        title: "Curb ramp torn out at Laurel St & 5th Ave",
        description: "Northeast corner ramp removed for sidewalk replacement. Cross at 6th Ave instead.",
        alternative: "Cross at Laurel St & 6th Ave", stop_id: null, source: "city_ada",
        raw_text: "Contractor removed the curb ramp at the NE corner of Laurel & 5th this morning for sidewalk replacement. No temporary ramp.",
        ai_generated: true,
      },
    },
  },
];
