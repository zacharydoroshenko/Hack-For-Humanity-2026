import type { ComponentType } from "react";
import type { PlanResponse, TravelMode } from "../api/client";
import { formatMin } from "../format";
import { IconCar, IconRideshare, IconRoll, IconTransit } from "./Icons";

export const MODES: { mode: TravelMode; label: string; Icon: ComponentType<{ size?: number }> }[] = [
  { mode: "transit", label: "Transit", Icon: IconTransit },
  { mode: "rideshare", label: "Rideshare", Icon: IconRideshare },
  { mode: "drive", label: "Drive", Icon: IconCar },
  { mode: "walk", label: "Roll", Icon: IconRoll },
];

export type ModeResult = PlanResponse | { error: string };

interface Props {
  selected: TravelMode;
  onSelect: (m: TravelMode) => void;
  results: Partial<Record<TravelMode, ModeResult>>;
  loading: boolean;
}

export default function ModeTabs({ selected, onSelect, results, loading }: Props) {
  return (
    <div className="mode-tabs" role="tablist" aria-label="Travel mode">
      {MODES.map(({ mode, label, Icon }) => {
        const r = results[mode];
        const ok = r && !("error" in r) ? r : null;
        const active = selected === mode;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={active}
            className={`mode-tab ${active ? "active" : ""} ${ok?.rerouted ? "changed" : ""}`}
            onClick={() => onSelect(mode)}
          >
            <Icon size={22} />
            <span className="mode-label">{label}</span>
            <span className="mode-time">
              {loading ? "…" : ok ? formatMin(ok.summary.duration_min) : r ? "n/a" : " "}
            </span>
            {ok?.rerouted && <span className="mode-flag">Changed</span>}
          </button>
        );
      })}
    </div>
  );
}
