/**
 * Elevation lookups from a real grid (AWS Terrain Tiles, built from USGS 3DEP/NED; see scripts/build_elevation_grid.py).
 * Grid spacing is about 80 m, so this is good for climbs over a block or more, not for curb-level detail.
 */
import type { LngLat } from "@shared/types";
import grid from "./real/elevation_grid.json";

const G = grid as { min_lon: number; min_lat: number; step: number; rows: number; cols: number; elev_m: number[][] };

/** Elevation in metres (bilinear), or null outside the grid. */
export function elevationAt([lon, lat]: LngLat): number | null {
  const x = (lon - G.min_lon) / G.step;
  const y = (lat - G.min_lat) / G.step;
  const c = Math.floor(x);
  const r = Math.floor(y);
  if (c < 0 || r < 0 || c >= G.cols - 1 || r >= G.rows - 1) return null;
  const fx = x - c;
  const fy = y - r;
  const E = G.elev_m;
  const top = E[r][c] * (1 - fx) + E[r][c + 1] * fx;
  const bot = E[r + 1][c] * (1 - fx) + E[r + 1][c + 1] * fx;
  return top * (1 - fy) + bot * fy;
}

const metres = (a: LngLat, b: LngLat) => {
  const k = Math.cos((a[1] * Math.PI) / 180) * 111320;
  return Math.hypot((a[0] - b[0]) * k, (a[1] - b[1]) * 111320);
};

export interface SlopeStats {
  /** total metres gained going along the path */
  climbM: number;
  /** total metres lost going along the path */
  descentM: number;
  lengthM: number;
  /** |end - start| / length */
  avgGrade: number;
}

/** Climb and average grade along a path, sampled every ~25 m. */
export function slopeStats(path: LngLat[]): SlopeStats {
  let climb = 0;
  let descent = 0;
  let length = 0;
  let prev: number | null = null;
  const first = elevationAt(path[0]);
  let last = first;
  for (let i = 0; i < path.length - 1; i++) {
    const L = metres(path[i], path[i + 1]);
    const n = Math.max(1, Math.round(L / 25));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const e = elevationAt([path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t]);
      if (e == null) continue;
      if (prev != null && e > prev) climb += e - prev;
      if (prev != null && e < prev) descent += prev - e;
      prev = e;
      last = e;
    }
    length += L;
  }
  const net = first != null && last != null ? Math.abs(last - first) : 0;
  return { climbM: Math.round(climb), descentM: Math.round(descent), lengthM: Math.round(length), avgGrade: length > 0 ? net / length : 0 };
}
