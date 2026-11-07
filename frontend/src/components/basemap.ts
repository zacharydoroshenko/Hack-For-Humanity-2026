/**
 * Simple, bright vector basemap: blue water, green parks, gray roads, no terrain/hillshade.
 *
 * Based on OpenFreeMap's "positron" style (free, no API key, OpenStreetMap data), recolored here.
 * Tweak COLORS to restyle the whole map.
 */
import type { StyleSpecification } from "maplibre-gl";

export const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

export const COLORS = {
  land: "#f7f7f3",
  residential: "#f1f1ec",
  building: "#e6e6e1",
  park: "#a6dd8c",
  wood: "#b9e5a2",
  water: "#74c0f0",
  waterway: "#74c0f0",
  roadMinor: "#dcdfe4",
  roadMajor: "#c3c8cf",
  roadMajorCasing: "#aeb4bd",
  motorway: "#a9b0ba",
  motorwayCasing: "#959ca7",
  rail: "#b5bac2",
  path: "#e6e8eb",
  airport: "#e9eaee",
  label: "#4b5563",
  waterLabel: "#1e6fa8",
};

/** layer id → paint overrides */
const PAINT: Record<string, Record<string, unknown>> = {
  background: { "background-color": COLORS.land },
  park: { "fill-color": COLORS.park, "fill-opacity": 0.85 },
  water: { "fill-color": COLORS.water },
  waterway: { "line-color": COLORS.waterway },
  landcover_wood: { "fill-color": COLORS.wood, "fill-opacity": 0.8 },
  landuse_residential: { "fill-color": COLORS.residential, "fill-opacity": 0.6 },
  building: { "fill-color": COLORS.building, "fill-outline-color": "#d9d9d3" },
  "aeroway-area": { "fill-color": COLORS.airport },
  highway_path: { "line-color": COLORS.path },
  highway_minor: { "line-color": COLORS.roadMinor, "line-opacity": 1 },
  highway_major_casing: { "line-color": COLORS.roadMajorCasing },
  highway_major_inner: { "line-color": COLORS.roadMajor },
  highway_major_subtle: { "line-color": COLORS.roadMajor },
  highway_motorway_casing: { "line-color": COLORS.motorwayCasing },
  highway_motorway_inner: { "line-color": COLORS.motorway },
  highway_motorway_subtle: { "line-color": COLORS.motorway },
  highway_motorway_bridge_casing: { "line-color": COLORS.motorwayCasing },
  highway_motorway_bridge_inner: { "line-color": COLORS.motorway },
  tunnel_motorway_casing: { "line-color": COLORS.motorwayCasing },
  tunnel_motorway_inner: { "line-color": COLORS.motorway },
  railway_transit: { "line-color": COLORS.rail },
  railway_service: { "line-color": COLORS.rail },
  railway: { "line-color": COLORS.rail },
};

export function recolor(style: StyleSpecification): StyleSpecification {
  const s = structuredClone(style);
  s.layers = s.layers
    // no terrain, hillshade or raster relief
    .filter((l) => l.type !== "hillshade" && l.type !== "raster" && !/hillshade|relief|shaded/.test(l.id))
    .map((l) => {
      const over = PAINT[l.id];
      if (over) l.paint = { ...(l.paint ?? {}), ...over } as typeof l.paint;
      if (l.type === "symbol" && l.paint) {
        const p = l.paint as Record<string, unknown>;
        if ("text-color" in p) p["text-color"] = l.id.startsWith("water") ? COLORS.waterLabel : COLORS.label;
      }
      return l;
    });
  return s;
}

export async function loadBasemapStyle(): Promise<StyleSpecification> {
  const res = await fetch(STYLE_URL);
  if (!res.ok) throw new Error(`basemap style ${res.status}`);
  return recolor((await res.json()) as StyleSpecification);
}
