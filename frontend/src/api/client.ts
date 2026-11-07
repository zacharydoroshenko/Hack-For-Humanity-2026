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
import { mockIngest, mockLayers, mockPlan, resetMock } from "../mock/server";

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
  if (USE_FIXTURES) return later(() => mockPlan(req), 700);
  return http("POST", "/plan", req);
}

export async function ingestAlert(req: AlertIngestRequest): Promise<AlertIngestResponse> {
  if (USE_FIXTURES) return later(() => mockIngest(req), 900);
  return http("POST", "/alerts/ingest", req);
}

/** Demo-only helper; not part of the frozen contract. */
export async function resetDemo(): Promise<void> {
  if (USE_FIXTURES) return later(resetMock, 50);
  await http("POST", "/demo/reset");
}

export const usingFixtures = USE_FIXTURES;
