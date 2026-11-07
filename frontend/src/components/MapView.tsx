import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, Popup, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "maplibre-gl/dist/maplibre-gl.css";
import "@maplibre/maplibre-gl-leaflet";
import { loadBasemapStyle } from "./basemap";
import {
  fromLatLng,
  toLatLng,
  type ClosureFeature,
  type CurbRampFeature,
  type LayersResponse,
  type LngLat,
  type PlanResponse,
  type StopFeature,
} from "../api/client";
import type { Endpoint } from "../demoConfig";
import type { PickMode } from "./SearchPanel";
import { markerIcon } from "./mapMarkers";

const CENTER: [number, number] = [32.815, -117.212];
/** San Diego County (Oceanside/Fallbrook to the border, coast to Imperial County line) */
const SD_COUNTY_BOUNDS = L.latLngBounds([32.52, -117.65], [33.52, -116.05]);
const NEAR_ROUTE_M = 350;

// ───────── geometry helpers (approximate, fine at city scale) ─────────
const M_PER_DEG_LAT = 111_320;
function distToSegmentM(p: LngLat, a: LngLat, b: LngLat): number {
  const k = Math.cos((p[1] * Math.PI) / 180) * M_PER_DEG_LAT;
  const [px, py] = [p[0] * k, p[1] * M_PER_DEG_LAT];
  const [ax, ay] = [a[0] * k, a[1] * M_PER_DEG_LAT];
  const [bx, by] = [b[0] * k, b[1] * M_PER_DEG_LAT];
  const dx = bx - ax;
  const dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function nearLine(p: LngLat, line: LngLat[], within: number): boolean {
  for (let i = 0; i < line.length - 1; i++) if (distToSegmentM(p, line[i], line[i + 1]) < within) return true;
  return false;
}
const firstPoint = (c: ClosureFeature): LngLat =>
  c.geometry.type === "Point" ? c.geometry.coordinates : c.geometry.coordinates[0];

// ───────── map pieces ─────────
function ClickHandler({ pickMode, onPick }: { pickMode: PickMode; onPick: (mode: "from" | "to", p: LngLat) => void }) {
  useMapEvents({
    click: (e) => {
      if (pickMode) onPick(pickMode, fromLatLng(e.latlng));
    },
    contextmenu: (e) => onPick("to", fromLatLng(e.latlng)),
  });
  return null;
}

/** Zoom to the route (or focused leg) whenever it changes. */
function FitBounds({ route, focusedLeg }: { route: PlanResponse | null; focusedLeg: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (!route) return;
    const legs = focusedLeg != null ? [route.legs[focusedLeg]] : route.legs;
    const pts = legs.flatMap((l) => l?.geometry.coordinates ?? []).map(toLatLng);
    if (pts.length) map.flyToBounds(L.latLngBounds(pts), { padding: [70, 70], maxZoom: 16, duration: 0.6 });
  }, [route, focusedLeg, map]);
  return null;
}

interface Props {
  layers: LayersResponse | null;
  route: PlanResponse | null;
  from: Endpoint | null;
  to: Endpoint | null;
  pickMode: PickMode;
  onPick: (mode: "from" | "to", p: LngLat) => void;
  focusedLeg: number | null;
  showAll: boolean;
}

export default function MapView({ layers, route, from, to, pickMode, onPick, focusedLeg, showAll }: Props) {
  /** Only what matters for the current route; everything when showAll is on. */
  const visible = useMemo(() => {
    const stops = layers?.stops.features ?? [];
    const closures = layers?.closures.features ?? [];
    const ramps = layers?.curb_ramps.features ?? [];
    if (showAll) return { stops, closures, ramps, routeStopIds: new Set<string>() };

    const routeStopIds = new Set<string>();
    const walkLines: LngLat[][] = [];
    const allLines: LngLat[][] = [];
    for (const leg of route?.legs ?? []) {
      allLines.push(leg.geometry.coordinates);
      if (leg.mode === "transit") {
        routeStopIds.add(leg.from_stop.stop_id);
        routeStopIds.add(leg.to_stop.stop_id);
      }
      if (leg.mode === "walk") walkLines.push(leg.geometry.coordinates);
    }
    const isOutage = (c: ClosureFeature) => c.properties.source === "mts_alerts";
    const hasTransit = routeStopIds.size > 0;

    // Without a route: just the trolley line's stations and live outages.
    // With a route: the stations you use, outages, and hazards/ramps next to the route.
    const vStops: StopFeature[] = stops.filter((s) =>
      route ? routeStopIds.has(s.properties.stop_id) || (hasTransit && s.properties.is_blue_line && s.properties.active_closure_ids.length > 0) : s.properties.is_blue_line,
    );
    const vClosures = closures.filter((c) => isOutage(c) || allLines.some((l) => nearLine(firstPoint(c), l, NEAR_ROUTE_M)));
    const vRamps: CurbRampFeature[] = ramps.filter((r) => walkLines.some((l) => nearLine(r.geometry.coordinates, l, NEAR_ROUTE_M)));
    return { stops: vStops, closures: vClosures, ramps: vRamps, routeStopIds };
  }, [layers, route, showAll]);

  const routeLines = useMemo(
    () =>
      route?.legs.map((leg, i) => {
        const dim = focusedLeg != null && focusedLeg !== i;
        const positions = leg.geometry.coordinates.map(toLatLng);
        const opacity = dim ? 0.3 : 1;
        if (leg.mode === "walk") {
          return (
            <Polyline key={`r${i}`} positions={positions} pathOptions={{ color: "#0f172a", weight: 5, dashArray: "1 10", lineCap: "round", opacity }} />
          );
        }
        const color = leg.mode === "transit" ? `#${leg.route_color}` : "#0891b2";
        return [
          <Polyline key={`r${i}c`} positions={positions} pathOptions={{ color: "#ffffff", weight: 11, opacity }} />,
          <Polyline key={`r${i}`} positions={positions} pathOptions={{ color, weight: 6, opacity }} />,
        ];
      }),
    [route, focusedLeg],
  );

  return (
    <MapContainer
      center={CENTER}
      zoom={12}
      minZoom={9}
      maxBounds={SD_COUNTY_BOUNDS}
      maxBoundsViscosity={1}
      className={`map ${pickMode ? "picking" : ""}`}
      keyboard
      zoomControl={false}
    >
      <VectorBasemap />
      <ClickHandler pickMode={pickMode} onPick={onPick} />
      <FitBounds route={route} focusedLeg={focusedLeg} />
      <ZoomControlBottomRight />

      {routeLines}

      {visible.stops.map((f) => {
        const closed = f.properties.active_closure_ids.length > 0;
        const p = f.properties;
        const icon = p.is_blue_line
          ? markerIcon(visible.routeStopIds.has(p.stop_id) ? "stationRoute" : "station")
          : markerIcon(p.wheelchair_boarding === 1 ? "stopOk" : p.wheelchair_boarding === 2 ? "stopNo" : "stopUnknown");
        return (
          <Marker key={p.stop_id} position={toLatLng(f.geometry.coordinates)} icon={icon}>
            <Tooltip direction="top" offset={[0, -10]}>
              {p.name}
              {closed ? " (outage)" : ""}
            </Tooltip>
          </Marker>
        );
      })}

      {visible.ramps.map((f) => (
        <Marker key={f.properties.id} position={toLatLng(f.geometry.coordinates)} icon={markerIcon("ramp")}>
          <Tooltip direction="top" offset={[0, -8]}>{f.properties.description ?? "Curb ramp issue"}</Tooltip>
        </Marker>
      ))}

      {visible.closures.map((f) => {
        const p = f.properties;
        const popup = (
          <Popup>
            <strong>{p.title}</strong>
            {p.description && <p>{p.description}</p>}
            {p.alternative && <p>Suggested: {p.alternative}</p>}
            <p className="muted">
              Source: {p.source.replace("_", " ")}
              {p.ai_generated && " · AI-interpreted"}
            </p>
            {p.raw_text && <p className="raw-text">“{p.raw_text}”</p>}
          </Popup>
        );
        if (f.geometry.type === "Point") {
          return (
            <Marker
              key={p.id}
              position={toLatLng(f.geometry.coordinates)}
              icon={markerIcon(p.severity === "blocking" ? "outage" : "warning")}
              zIndexOffset={1000}
            >
              <Tooltip direction="top" offset={[0, -14]}>{p.title}</Tooltip>
              {popup}
            </Marker>
          );
        }
        return (
          <Polyline
            key={p.id}
            positions={f.geometry.coordinates.map(toLatLng)}
            pathOptions={{ color: p.severity === "blocking" ? "#b91c1c" : "#d97706", weight: 7, dashArray: p.severity === "warning" ? "8 6" : undefined }}
          >
            <Tooltip sticky>{p.title}</Tooltip>
            {popup}
          </Polyline>
        );
      })}

      {from && (
        <Marker position={toLatLng(from.coord)} icon={markerIcon("start")} zIndexOffset={2000}>
          <Tooltip direction="top" offset={[0, -12]}>Start: {from.label}</Tooltip>
        </Marker>
      )}
      {to && (
        <Marker position={toLatLng(to.coord)} icon={markerIcon("end")} zIndexOffset={2000}>
          <Tooltip direction="top" offset={[0, -34]}>Destination: {to.label}</Tooltip>
        </Marker>
      )}
    </MapContainer>
  );
}

function ZoomControlBottomRight() {
  const map = useMap();
  useEffect(() => {
    const c = L.control.zoom({ position: "bottomright" }).addTo(map);
    return () => {
      c.remove();
    };
  }, [map]);
  return null;
}

/** Recolored vector basemap (see basemap.ts). Falls back to standard OSM tiles if the style can't load. */
function VectorBasemap() {
  const map = useMap();
  useEffect(() => {
    let layer: L.Layer | null = null;
    let cancelled = false;
    const attribution =
      '&copy; <a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    loadBasemapStyle()
      .then((style) => {
        if (cancelled) return;
        layer = L.maplibreGL({ style, interactive: false }).addTo(map);
        map.attributionControl?.addAttribution(attribution);
      })
      .catch(() => {
        if (cancelled) return;
        layer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
      });
    return () => {
      cancelled = true;
      layer?.remove();
      map.attributionControl?.removeAttribution(attribution);
    };
  }, [map]);
  return null;
}
