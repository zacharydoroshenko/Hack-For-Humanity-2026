/**
 * THE ONLY FILE IN frontend/ THAT TOUCHES THE GLUE.
 *
 * - Only place that calls fetch / knows URLs.
 * - Only place that knows coordinates are [lon, lat]; exports helpers for Leaflet's [lat, lon].
 * - VITE_USE_FIXTURES=1 serves shared/fixtures/ instead of the backend.
 *
 * Components import the typed functions below and nothing from the network.
 */
import type {
  AlertIngestRequest,
  AlertIngestResponse,
  HealthResponse,
  LayersResponse,
  LngLat,
  PlanRequest,
  PlanResponse,
} from "@shared/types";
import layersFixture from "@shared/fixtures/layers.json";
import planNormalFixture from "@shared/fixtures/plan_normal.json";
import planReroutedFixture from "@shared/fixtures/plan_rerouted.json";
import alertFixture from "@shared/fixtures/alert_ingest.json";

export type * from "@shared/types";

const USE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === "1";
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

/** GeoJSON [lon, lat] -> Leaflet [lat, lon] */
export const toLatLng = ([lon, lat]: LngLat): [number, number] => [lat, lon];
/** Leaflet {lat, lng} -> GeoJSON [lon, lat] */
export const fromLatLng = (p: { lat: number; lng: number }): LngLat => [p.lng, p.lat];

async function http<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

// ── fixture mode: mimic the backend's demo state ──
let fixtureAlertIngested = false;
const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 250));

function fixtureLayers(): LayersResponse {
  const data = structuredClone(layersFixture) as LayersResponse;
  if (!fixtureAlertIngested) {
    data.closures.features = data.closures.features.filter((f) => f.properties.source !== "mts_alerts");
    const active = new Set(data.closures.features.map((f) => f.properties.id));
    for (const s of data.stops.features) {
      s.properties.active_closure_ids = s.properties.active_closure_ids.filter((id) => active.has(id));
    }
  }
  return data;
}

// ── public API ──

export async function getHealth(): Promise<HealthResponse> {
  if (USE_FIXTURES) return delay({ ok: true, gemini: true });
  return http("GET", "/health");
}

export async function getLayers(): Promise<LayersResponse> {
  if (USE_FIXTURES) return delay(fixtureLayers());
  return http("GET", "/layers");
}

export async function plan(req: PlanRequest): Promise<PlanResponse> {
  if (USE_FIXTURES) {
    return delay((fixtureAlertIngested ? planReroutedFixture : planNormalFixture) as PlanResponse);
  }
  return http("POST", "/plan", req);
}

export async function ingestAlert(req: AlertIngestRequest): Promise<AlertIngestResponse> {
  if (USE_FIXTURES) {
    fixtureAlertIngested = true;
    return delay(alertFixture as AlertIngestResponse);
  }
  return http("POST", "/alerts/ingest", req);
}

/** Demo-only helper; not part of the frozen contract. */
export async function resetDemo(): Promise<void> {
  if (USE_FIXTURES) {
    fixtureAlertIngested = false;
    return;
  }
  await http("POST", "/demo/reset");
}

export const usingFixtures = USE_FIXTURES;
