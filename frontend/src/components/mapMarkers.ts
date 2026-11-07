/** SVG marker art shared by the map and the legend. No emoji. */
import L from "leaflet";

const BLUE = "#1d4ed8";
const RED = "#b91c1c";
const AMBER = "#d97706";
const INK = "#0f172a";

export const MARKER_SVG = {
  start: `<svg viewBox="0 0 22 22" width="22" height="22"><circle cx="11" cy="11" r="7" fill="#fff" stroke="${INK}" stroke-width="4"/></svg>`,
  end: `<svg viewBox="0 0 28 36" width="28" height="36"><path d="M14 35s11-10.2 11-20A11 11 0 0 0 3 15c0 9.8 11 20 11 20Z" fill="${INK}"/><circle cx="14" cy="14.5" r="4.5" fill="#fff"/></svg>`,
  station: `<svg viewBox="0 0 18 18" width="18" height="18"><circle cx="9" cy="9" r="6" fill="#fff" stroke="${BLUE}" stroke-width="3.5"/></svg>`,
  stationRoute: `<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="8" fill="#fff" stroke="${BLUE}" stroke-width="4.5"/></svg>`,
  outage: `<svg viewBox="0 0 26 26" width="26" height="26"><path d="M8.6 1.5h8.8l7.1 7.1v8.8l-7.1 7.1H8.6l-7.1-7.1V8.6Z" fill="${RED}" stroke="#fff" stroke-width="2"/><path d="M13 7.5v6.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="13" cy="18" r="1.5" fill="#fff"/></svg>`,
  warning: `<svg viewBox="0 0 24 22" width="24" height="22"><path d="M10.3 2.2 1.4 17.7A2 2 0 0 0 3.1 20.7h17.8a2 2 0 0 0 1.7-3L13.7 2.2a2 2 0 0 0-3.4 0Z" fill="${AMBER}" stroke="#fff" stroke-width="1.8"/><path d="M12 7.5v5.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="16.5" r="1.4" fill="#fff"/></svg>`,
  ramp: `<svg viewBox="0 0 16 16" width="16" height="16"><rect x="3" y="3" width="10" height="10" rx="1.5" transform="rotate(45 8 8)" fill="#ea580c" stroke="#fff" stroke-width="1.8"/></svg>`,
  report: `<svg viewBox="0 0 14 14" width="14" height="14"><circle cx="7" cy="7" r="5" fill="#f59e0b" stroke="#fff" stroke-width="2"/></svg>`,
  stopOk: `<svg viewBox="0 0 12 12" width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="#15803d" stroke="#fff" stroke-width="1.5"/></svg>`,
  stopUnknown: `<svg viewBox="0 0 12 12" width="12" height="12"><circle cx="6" cy="6" r="4" fill="#fff" stroke="#64748b" stroke-width="2"/></svg>`,
  stopNo: `<svg viewBox="0 0 12 12" width="12" height="12"><rect x="1.5" y="1.5" width="9" height="9" fill="${RED}" stroke="#fff" stroke-width="1.5"/></svg>`,
} as const;

type Key = keyof typeof MARKER_SVG;

const SIZES: Record<Key, [number, number, number, number]> = {
  // w, h, anchorX, anchorY
  start: [22, 22, 11, 11],
  end: [28, 36, 14, 35],
  station: [18, 18, 9, 9],
  stationRoute: [24, 24, 12, 12],
  outage: [26, 26, 13, 13],
  warning: [24, 22, 12, 11],
  ramp: [16, 16, 8, 8],
  report: [14, 14, 7, 7],
  stopOk: [12, 12, 6, 6],
  stopUnknown: [12, 12, 6, 6],
  stopNo: [12, 12, 6, 6],
};

const cache = new Map<Key, L.DivIcon>();

export function markerIcon(key: Key): L.DivIcon {
  let icon = cache.get(key);
  if (!icon) {
    const [w, h, ax, ay] = SIZES[key];
    icon = L.divIcon({ html: MARKER_SVG[key], className: "svg-marker", iconSize: [w, h], iconAnchor: [ax, ay] });
    cache.set(key, icon);
  }
  return icon;
}
