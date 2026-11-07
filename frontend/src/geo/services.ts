/**
 * Public OpenStreetMap services (no API key):
 * - Photon (photon.komoot.io): address / place search-as-you-type, limited to San Diego County
 * - Valhalla (valhalla1.openstreetmap.de): real rolling paths with the wheelchair pedestrian profile
 *
 * Both are shared community servers: keep requests few (debounced search, cached routes).
 */
import type { LngLat, Step } from "@shared/types";

const SD_COUNTY_BBOX = "-117.65,32.52,-116.05,33.52";
const BIAS = { lat: 32.8, lon: -117.18 };

export interface Suggestion {
  label: string;
  detail: string;
  coord: LngLat;
}

interface PhotonFeature {
  geometry: { coordinates: LngLat };
  properties: Record<string, string | undefined>;
}

function describe(p: Record<string, string | undefined>): { label: string; detail: string } {
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const label = p.name ?? (street || p.city || "Unnamed place");
  const detail = [p.name ? street : null, p.district ?? p.locality, p.city ?? p.county].filter((x) => x && x !== label).join(", ");
  return { label, detail };
}

/** Places matching `q` in San Diego County, best first. */
export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en&bbox=${SD_COUNTY_BBOX}&lat=${BIAS.lat}&lon=${BIAS.lon}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`search ${res.status}`);
  const data = (await res.json()) as { features: PhotonFeature[] };
  const seen = new Set<string>();
  return data.features
    .map((f) => ({ ...describe(f.properties), coord: f.geometry.coordinates }))
    .filter((s) => {
      const k = `${s.label}|${s.detail}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

/** Best label for a point picked on the map, e.g. "9500 Gilman Dr" or "Price Center". */
export async function reverseGeocode([lon, lat]: LngLat): Promise<string | null> {
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}&lang=en&limit=1`);
    if (!res.ok) return null;
    const f = ((await res.json()) as { features: PhotonFeature[] }).features[0];
    if (!f) return null;
    const { label, detail } = describe(f.properties);
    return detail ? `${label}, ${detail.split(", ")[0]}` : label;
  } catch {
    return null;
  }
}

// ───────── Valhalla wheelchair routing ─────────

export interface RealPath {
  coords: LngLat[];
  distance_m: number;
  steps: Step[];
}

/** Valhalla encodes shapes as polyline6. */
function decodePolyline6(str: string): LngLat[] {
  const out: LngLat[] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < str.length) {
    for (const which of [0, 1]) {
      let result = 0;
      let shift = 0;
      let b: number;
      do {
        b = str.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta;
      else lon += delta;
    }
    out.push([lon / 1e6, lat / 1e6]);
  }
  return out;
}

/** A wheelchair-accessible path between two points (follows sidewalks/crossings, avoids steps). */
export async function fetchWheelchairPath(from: LngLat, to: LngLat, signal?: AbortSignal): Promise<RealPath> {
  const body = {
    locations: [
      { lat: from[1], lon: from[0] },
      { lat: to[1], lon: to[0] },
    ],
    costing: "pedestrian",
    costing_options: { pedestrian: { type: "wheelchair" } },
    directions_options: { units: "kilometers" },
  };
  const res = await fetch(`https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(body))}`, { signal });
  if (!res.ok) throw new Error(`route ${res.status}`);
  const trip = ((await res.json()) as { trip: { legs: { shape: string; maneuvers: { instruction: string; length: number; type: number }[] }[]; summary: { length: number } } }).trip;
  const leg = trip.legs[0];
  return {
    coords: decodePolyline6(leg.shape),
    distance_m: Math.round(trip.summary.length * 1000),
    // drop Valhalla's "you have arrived" maneuvers (types 4-6); the planner adds its own arrival step
    steps: leg.maneuvers.filter((m) => m.type < 4 || m.type > 6).map((m) => ({ instruction: m.instruction.replace(/\.$/, ""), distance_m: Math.round(m.length * 1000) })),
  };
}
