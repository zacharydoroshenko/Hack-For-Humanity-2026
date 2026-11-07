/** UI-side demo config: place list for the pickers and the demo alert options. */
import { DEMO_ALERTS, PLACES } from "./mock/data";
import type { LngLat } from "./api/client";

export { PLACES };
export type { Place } from "./mock/data";

export const DEMO_ALERT_OPTIONS = DEMO_ALERTS.map((a) => ({ file: a.file, label: a.label }));
export const DEFAULT_DEMO_ALERT = "ucsd_central_elevator.json";

export interface Endpoint {
  coord: LngLat;
  label: string;
}

const place = (name: string): Endpoint => {
  const p = PLACES.find((x) => x.name === name)!;
  return { coord: p.coord, label: p.name };
};

/** The happy path's default trip. */
export const HAPPY_PATH = {
  from: place("Geisel Library"),
  to: place("Old Town State Historic Park"),
  maxGrade: 0.04, // manual chair
};

/** The DEMO.md trip: Price Center Theater -> Old Town -> Balboa Park -> USS Midway, manual chair. */
export const DEMO_TRIP = {
  from: place("Price Center Theater"),
  via: [place("Old Town State Historic Park"), place("Balboa Park (Laurel St entrance)")],
  to: place("USS Midway Museum"),
  maxGrade: 0.04,
};
