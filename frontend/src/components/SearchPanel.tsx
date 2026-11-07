import type { LngLat } from "../api/client";

export interface SearchSettings {
  text: string;
  maxGrade: number;
  avoidUnverified: boolean;
}

interface Props {
  settings: SearchSettings;
  onChange: (s: SearchSettings) => void;
  from: LngLat | null;
  to: LngLat | null;
  onSubmit: () => void;
  loading: boolean;
}

const fmt = (p: LngLat | null) => (p ? `${p[1].toFixed(4)}, ${p[0].toFixed(4)}` : "not set");

export default function SearchPanel({ settings, onChange, from, to, onSubmit, loading }: Props) {
  return (
    <form
      className="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="req">Describe your trip</label>
      <textarea
        id="req"
        rows={2}
        placeholder="e.g. Manual wheelchair, Geisel Library to Old Town, avoid hills"
        value={settings.text}
        onChange={(e) => onChange({ ...settings, text: e.target.value })}
      />

      <p className="hint">
        Or click the map to set the start (shift-click or right-click sets the destination).
        <br />Start: {fmt(from)} · Destination: {fmt(to)}
      </p>

      <label htmlFor="grade">Max slope: {(settings.maxGrade * 100).toFixed(1)}%</label>
      <input
        id="grade"
        type="range"
        min={0.02}
        max={0.0833}
        step={0.005}
        value={settings.maxGrade}
        onChange={(e) => onChange({ ...settings, maxGrade: Number(e.target.value) })}
      />

      <label className="checkbox">
        <input
          type="checkbox"
          checked={settings.avoidUnverified}
          onChange={(e) => onChange({ ...settings, avoidUnverified: e.target.checked })}
        />
        Avoid unverified sidewalks
      </label>

      <button type="submit" disabled={loading}>{loading ? "Planning…" : "Plan accessible trip"}</button>
    </form>
  );
}
