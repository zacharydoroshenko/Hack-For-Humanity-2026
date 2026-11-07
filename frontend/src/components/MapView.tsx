import { CircleMarker, LayerGroup, LayersControl, MapContainer, Marker, Polyline, Popup, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { toLatLng, fromLatLng, type LayersResponse, type LngLat, type PlanResponse } from "../api/client";

const CENTER: [number, number] = [32.81, -117.215];

const emojiIcon = (emoji: string, label: string) =>
  L.divIcon({ className: "emoji-icon", html: `<span role="img" aria-label="${label}">${emoji}</span>`, iconSize: [24, 24] });

const ICONS = {
  from: emojiIcon("🟢", "Start"),
  to: emojiIcon("🏁", "Destination"),
  blocking: emojiIcon("⛔", "Blocking closure"),
  warning: emojiIcon("⚠️", "Warning"),
  ramp: emojiIcon("♿", "Curb ramp issue"),
};

// wheelchair_boarding: 0 unknown, 1 accessible, 2 not accessible
const STOP_STYLE = {
  0: { color: "#6b7280", label: "Accessibility unknown" },
  1: { color: "#15803d", label: "Wheelchair accessible" },
  2: { color: "#b91c1c", label: "Not wheelchair accessible" },
} as const;

function ClickToPick({ onPickFrom, onPickTo }: { onPickFrom: (p: LngLat) => void; onPickTo: (p: LngLat) => void }) {
  useMapEvents({
    click: (e) => (e.originalEvent.shiftKey ? onPickTo(fromLatLng(e.latlng)) : onPickFrom(fromLatLng(e.latlng))),
    contextmenu: (e) => onPickTo(fromLatLng(e.latlng)),
  });
  return null;
}

interface Props {
  layers: LayersResponse | null;
  route: PlanResponse | null;
  from: LngLat | null;
  to: LngLat | null;
  onPickFrom: (p: LngLat) => void;
  onPickTo: (p: LngLat) => void;
}

export default function MapView({ layers, route, from, to, onPickFrom, onPickTo }: Props) {
  return (
    <MapContainer center={CENTER} zoom={12} className="map" aria-label="Map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickToPick onPickFrom={onPickFrom} onPickTo={onPickTo} />

      {from && <Marker position={toLatLng(from)} icon={ICONS.from} />}
      {to && <Marker position={toLatLng(to)} icon={ICONS.to} />}

      {route?.legs.map((leg, i) => (
        <Polyline
          key={i}
          positions={leg.geometry.coordinates.map(toLatLng)}
          pathOptions={
            leg.mode === "walk"
              ? { color: "#111827", weight: 5, dashArray: "6 8" }
              : { color: `#${leg.route_color}`, weight: 7 }
          }
        />
      ))}

      <LayersControl position="topright">
        <LayersControl.Overlay checked name="Stops">
          <LayerGroupStops layers={layers} />
        </LayersControl.Overlay>
        <LayersControl.Overlay checked name="Closures">
          <LayerGroupClosures layers={layers} />
        </LayersControl.Overlay>
        <LayersControl.Overlay checked name="Curb ramp issues">
          <LayerGroupRamps layers={layers} />
        </LayersControl.Overlay>
      </LayersControl>
    </MapContainer>
  );
}


function LayerGroupStops({ layers }: { layers: LayersResponse | null }) {
  return (
    <LayerGroup>
      {layers?.stops.features.map((f) => {
        const s = STOP_STYLE[f.properties.wheelchair_boarding];
        const closed = f.properties.active_closure_ids.length > 0;
        return (
          <CircleMarker
            key={f.properties.stop_id}
            center={toLatLng(f.geometry.coordinates)}
            radius={f.properties.is_blue_line ? 8 : 5}
            pathOptions={{ color: closed ? "#b91c1c" : s.color, fillOpacity: 0.8, weight: closed ? 4 : 2 }}
          >
            <Popup>
              <strong>{f.properties.name}</strong>
              <br />
              {s.label}
              {closed && <><br />⛔ Active closure</>}
            </Popup>
          </CircleMarker>
        );
      })}
    </LayerGroup>
  );
}

function LayerGroupClosures({ layers }: { layers: LayersResponse | null }) {
  return (
    <LayerGroup>
      {layers?.closures.features.map((f) => {
        const p = f.properties;
        const popup = (
          <Popup>
            <strong>{p.title}</strong>
            {p.description && <p>{p.description}</p>}
            {p.alternative && <p>➡️ {p.alternative}</p>}
            {p.ai_generated && <span className="ai-chip" title={p.raw_text ?? ""}>AI-interpreted</span>}
          </Popup>
        );
        if (f.geometry.type === "Point") {
          return (
            <Marker key={p.id} position={toLatLng(f.geometry.coordinates)} icon={p.severity === "blocking" ? ICONS.blocking : ICONS.warning}>
              {popup}
            </Marker>
          );
        }
        return (
          <Polyline
            key={p.id}
            positions={f.geometry.coordinates.map(toLatLng)}
            pathOptions={{ color: p.severity === "blocking" ? "#b91c1c" : "#d97706", weight: 6 }}
          >
            {popup}
          </Polyline>
        );
      })}
    </LayerGroup>
  );
}

function LayerGroupRamps({ layers }: { layers: LayersResponse | null }) {
  return (
    <LayerGroup>
      {layers?.curb_ramps.features.map((f) => (
        <Marker key={f.properties.id} position={toLatLng(f.geometry.coordinates)} icon={ICONS.ramp}>
          <Popup>{f.properties.description ?? "Curb ramp issue"}</Popup>
        </Marker>
      ))}
    </LayerGroup>
  );
}
