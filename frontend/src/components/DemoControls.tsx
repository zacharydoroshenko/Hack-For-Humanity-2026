import { useState } from "react";
import { DEFAULT_DEMO_ALERT, DEMO_ALERT_OPTIONS } from "../demoConfig";

interface Props {
  onSimulate: (file: string) => Promise<void>;
  onReset: () => Promise<void>;
  busy: boolean;
}

export default function DemoControls({ onSimulate, onReset, busy }: Props) {
  const [file, setFile] = useState(DEFAULT_DEMO_ALERT);
  return (
    <section className="demo-controls" aria-label="Demo controls">
      <h2 className="small-heading">Demo: replay an MTS alert</h2>
      <ul className="hotkeys" aria-label="Demo hotkeys">
        {DEMO_ALERT_OPTIONS.map((a, i) => (
          <li key={a.file}><kbd>{i + 1}</kbd> {a.label}</li>
        ))}
        <li><kbd>0</kbd> Reset</li>
        <li><kbd>P</kbd> Plan trip</li>
        <li><kbd>D</kbd> Hide this panel</li>
      </ul>
      <label htmlFor="demo-alert" className="sr-only">Alert to replay</label>
      <select id="demo-alert" value={file} onChange={(e) => setFile(e.target.value)}>
        {DEMO_ALERT_OPTIONS.map((a) => (
          <option key={a.file} value={a.file}>{a.label}</option>
        ))}
      </select>
      <div className="demo-row">
        <button type="button" className="danger" disabled={busy} onClick={() => onSimulate(file)}>
          {busy ? "Reading alert…" : "Simulate outage"}
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={onReset}>
          Reset
        </button>
      </div>
    </section>
  );
}
