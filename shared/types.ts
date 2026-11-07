/**
 * FROZEN GLUE: the API contract between frontend/ and backend/.
 *
 * Must match backend/contract.py exactly. See ARCHITECTURE.md §3 for the change rules:
 *   - Additive (new optional field / endpoint): one `contract:` commit updating
 *     this file + backend/contract.py + a fixture, and tell the team.
 *   - Breaking (rename/remove/retype): both owners agree first. None after 2:15.
 *
 * All coordinates are GeoJSON order: [lon, lat].
 */

export type LngLat = [number, number];

export interface PointGeometry {
  type: "Point";
  coordinates: LngLat;
}

export interface LineStringGeometry {
  type: "LineString";
  coordinates: LngLat[];
}

/** 0 = unknown, 1 = accessible, 2 = not accessible (GTFS wheelchair_boarding) */
export type WheelchairBoarding = 0 | 1 | 2;

export type ClosureKind =
  | "elevator_outage"
  | "stop_closure"
  | "missing_curb_ramp"
  | "steep_segment"
  | "reported_hazard";

export type Severity = "blocking" | "warning";

export type ClosureSource = "mts_alerts" | "city_ada" | "usgs" | "get_it_done";

export type WarningType = "unverified" | "steep" | "hazard" | "missing_curb_ramp";

// ───────────────────────── POST /plan ─────────────────────────

export interface PlanRequest {
  /** Natural-language request; Gemini parses it into the fields below. */
  text?: string;
  from?: LngLat;
  to?: LngLat;
  max_grade?: number; // default 0.05
  avoid_unverified?: boolean; // default false
}

export interface ParsedRequest {
  from_text: string | null;
  to_text: string | null;
  max_grade: number;
  avoid_unverified: boolean;
  ai_generated: boolean;
}

export interface RouteWarning {
  type: WarningType;
  message: string;
}

export interface Step {
  instruction: string;
  distance_m: number;
}

export interface StopRef {
  stop_id: string;
  name: string;
  wheelchair_boarding: WheelchairBoarding;
}

export interface WalkLeg {
  mode: "walk";
  geometry: LineStringGeometry;
  distance_m: number;
  duration_min: number;
  warnings: RouteWarning[];
  steps: Step[];
}

export interface TransitLeg {
  mode: "transit";
  route_short_name: string;
  route_color: string; // hex without '#', e.g. "0000FF"
  from_stop: StopRef;
  to_stop: StopRef;
  duration_min: number;
  geometry: LineStringGeometry;
}

export type Leg = WalkLeg | TransitLeg;

export interface Reroute {
  cause_closure_ids: string[];
  explanation: string[];
  ai_generated: boolean;
}

export interface PlanResponse {
  parsed_request: ParsedRequest | null;
  summary: {
    duration_min: number;
    walk_m: number;
    transfers: number;
  };
  legs: Leg[];
  rerouted: boolean;
  reroute: Reroute | null;
}

// ───────────────────────── GET /layers ─────────────────────────

export interface Feature<G, P> {
  type: "Feature";
  geometry: G;
  properties: P;
}

export interface FeatureCollection<F> {
  type: "FeatureCollection";
  features: F[];
}

export interface StopProps {
  stop_id: string;
  name: string;
  wheelchair_boarding: WheelchairBoarding;
  is_blue_line: boolean;
  active_closure_ids: string[];
}

export interface ClosureProps {
  id: string;
  kind: ClosureKind;
  severity: Severity;
  title: string;
  description: string | null;
  alternative: string | null;
  stop_id: string | null;
  source: ClosureSource;
  raw_text: string | null;
  ai_generated: boolean;
}

export interface CurbRampProps {
  id: string;
  description: string | null;
}

export type StopFeature = Feature<PointGeometry, StopProps>;
export type ClosureFeature = Feature<PointGeometry | LineStringGeometry, ClosureProps>;
export type CurbRampFeature = Feature<PointGeometry, CurbRampProps>;

export interface LayersResponse {
  stops: FeatureCollection<StopFeature>;
  closures: FeatureCollection<ClosureFeature>;
  curb_ramps: FeatureCollection<CurbRampFeature>;
}

// ───────────────────────── POST /alerts/ingest ─────────────────────────

export interface AlertIngestRequest {
  /** Filename in data/demo_alerts/, e.g. "old_town_elevator.json" */
  demo_file?: string;
  /** A raw GTFS-RT alert entity as JSON */
  alert?: Record<string, unknown>;
}

export interface AlertIngestResponse {
  closure: ClosureFeature;
}

// ───────────────────────── GET /health ─────────────────────────

export interface HealthResponse {
  ok: boolean;
  gemini: boolean;
}
