import type { Endpoint } from "../demoConfig";
import PlaceInput from "./PlaceInput";
import { IconChevron, IconSliders, IconSwap } from "./Icons";

export interface SearchSettings {
  maxGrade: number;
  avoidUnverified: boolean;
  showAllMapDetails: boolean;
}

export type PickMode = "from" | "to" | null;

interface Props {
  settings: SearchSettings;
  onChange: (s: SearchSettings) => void;
  from: Endpoint | null;
  to: Endpoint | null;
  onFrom: (e: Endpoint | null) => void;
  onTo: (e: Endpoint | null) => void;
  pickMode: PickMode;
  onPickMode: (m: PickMode) => void;
  onSubmit: () => void;
  loading: boolean;
}

const GRADE_PRESETS = [
  { label: "Manual chair", value: 0.04 },
  { label: "Standard", value: 0.05 },
  { label: "Power chair", value: 0.0833 },
];

export default function SearchPanel(props: Props) {
  const { settings, onChange, from, to, onFrom, onTo, pickMode, onPickMode, onSubmit, loading } = props;
  const canSubmit = !loading && !!from && !!to;
  const preset = GRADE_PRESETS.find((p) => Math.abs(settings.maxGrade - p.value) < 1e-4);

  return (
    <form
      className="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      <fieldset className="endpoints">
        <legend className="sr-only">Start and destination</legend>
        <div className="endpoint-rail" aria-hidden="true">
          <span className="rail-start" />
          <span className="rail-line" />
          <span className="rail-end" />
        </div>
        <div className="endpoint-fields">
          <PlaceInput
            label="Start"
            value={from}
            onChange={onFrom}
            picking={pickMode === "from"}
            onPickOnMap={() => onPickMode(pickMode === "from" ? null : "from")}
          />
          <PlaceInput
            label="Destination"
            value={to}
            onChange={onTo}
            picking={pickMode === "to"}
            onPickOnMap={() => onPickMode(pickMode === "to" ? null : "to")}
          />
        </div>
        <button
          type="button"
          className="swap-btn"
          onClick={() => {
            onFrom(to);
            onTo(from);
          }}
          aria-label="Swap start and destination"
          title="Swap start and destination"
        >
          <IconSwap size={18} />
        </button>
      </fieldset>
      {pickMode && (
        <p className="hint picking" role="status">
          Click the map to set the {pickMode === "from" ? "start" : "destination"}. Press Esc to cancel.
        </p>
      )}

      <details className="prefs">
        <summary>
          <IconSliders size={18} />
          <span className="prefs-title">Route preferences</span>
          <span className="prefs-summary">
            Slope {(settings.maxGrade * 100).toFixed(1)}%{preset ? ` (${preset.label})` : ""}
            {settings.avoidUnverified ? " · verified only" : ""}
          </span>
          <IconChevron size={18} className="prefs-chevron" />
        </summary>

        <div className="prefs-body">
          <fieldset className="grade">
            <legend className="field-label">Maximum slope: {(settings.maxGrade * 100).toFixed(1)}%</legend>
            <div className="preset-row">
              {GRADE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className={`chip-btn ${preset === p ? "active" : ""}`}
                  aria-pressed={preset === p}
                  onClick={() => onChange({ ...settings, maxGrade: p.value })}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label htmlFor="grade" className="sr-only">Maximum slope</label>
            <input
              id="grade"
              type="range"
              min={0.02}
              max={0.0833}
              step={0.0005}
              value={settings.maxGrade}
              aria-valuetext={`${(settings.maxGrade * 100).toFixed(1)} percent`}
              onChange={(e) => onChange({ ...settings, maxGrade: Number(e.target.value) })}
            />
            <div className="range-labels" aria-hidden="true">
              <span>2%</span>
              <span>ADA ramp max 8.33%</span>
            </div>
          </fieldset>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.avoidUnverified}
              onChange={(e) => onChange({ ...settings, avoidUnverified: e.target.checked })}
            />
            Only use verified sidewalks
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.showAllMapDetails}
              onChange={(e) => onChange({ ...settings, showAllMapDetails: e.target.checked })}
            />
            Show all stops and hazards on the map
          </label>
        </div>
      </details>

      <button type="submit" className="primary" disabled={!canSubmit}>
        {loading ? "Finding routes…" : "Find accessible routes"}
      </button>
    </form>
  );
}
