/**
 * THE ONLY FILE IN frontend/ THAT TOUCHES THE GLUE.
 *
 * - Only place that calls fetch / knows URLs.
 * - Only place that knows coordinates are [lon, lat]; exports helpers for Leaflet's [lat, lon].
 * - VITE_USE_FIXTURES=1 serves the in-browser mock backend (src/mock/) instead of the real one.
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
import { mockIngest, mockIngestClosure, mockLayers, mockPlan, resetMock, setRealPath, takeWantedPaths } from "../mock/server";
import { fetchWheelchairPath } from "../geo/services";

export type * from "@shared/types";

const USE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === "1";
/** Demo hybrid: mock routing, but alerts go through the real backend (Gemini). Falls back to the mock. */
const LIVE_ALERTS = USE_FIXTURES && import.meta.env.VITE_LIVE_ALERTS === "1";
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
  if (!res.ok) {
    let detail = await res.text();
    try {
      detail = JSON.parse(detail).detail ?? detail;
    } catch {
      /* not JSON */
    }
    throw new Error(`${res.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
  return (await res.json()) as T;
}

/** Simulate network latency so loading states are visible in mock mode. */
const later = <T,>(fn: () => T, ms = 350) =>
  new Promise<T>((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(fn());
      } catch (e) {
        reject(e);
      }
    }, ms),
  );

/**
 * In-browser planner with real rolling paths: plan once to learn which rolling legs are needed, fetch their
 * wheelchair paths (Valhalla, in parallel, cached), then plan again on the real paths. Anything the router
 * can't answer within a few seconds keeps the simple placeholder line.
 */
async function planWithRealPaths(req: PlanRequest): Promise<PlanResponse> {
  for (let pass = 0; pass < 3; pass++) {
    const r = mockPlan(req);
    const wanted = takeWantedPaths();
    if (!wanted.length) return r;
    await mapLimit(wanted, 4, async ([a, b]) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      try {
        setRealPath(a, b, await fetchWheelchairPath(a, b, ctrl.signal));
      } catch {
        setRealPath(a, b, null);
      } finally {
        clearTimeout(timer);
      }
    });
  }
  return mockPlan(req);
}

async function mapLimit<T>(items: T[], limit: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

// ── public API ──

export async function getHealth(): Promise<HealthResponse> {
  if (USE_FIXTURES) return later(() => ({ ok: true, gemini: true }), 50);
  return http("GET", "/health");
}

export async function getLayers(): Promise<LayersResponse> {
  if (USE_FIXTURES) return later(mockLayers);
  return http("GET", "/layers");
}

export async function plan(req: PlanRequest): Promise<PlanResponse> {
  if (USE_FIXTURES) return planWithRealPaths(req);
  return http("POST", "/plan", req);
}

export async function ingestAlert(req: AlertIngestRequest): Promise<AlertIngestResponse> {
  if (LIVE_ALERTS) {
    try {
      const live = await http<AlertIngestResponse>("POST", "/alerts/ingest", req);
      mockIngestClosure(live.closure, req.demo_file);
      return live;
    } catch (e) {
      console.warn("[SafeRoute] live alert ingest failed; using the mock instead.", e);
    }
  }
  if (USE_FIXTURES) return later(() => mockIngest(req), 900);
  return http("POST", "/alerts/ingest", req);
}

/** Demo-only helper; not part of the frozen contract. */
export async function resetDemo(): Promise<void> {
  if (LIVE_ALERTS) await http("POST", "/demo/reset").catch(() => undefined);
  if (USE_FIXTURES) return later(resetMock, 50);
  await http("POST", "/demo/reset");
}

export const usingFixtures = USE_FIXTURES;
export const usingLiveAlerts = LIVE_ALERTS;
