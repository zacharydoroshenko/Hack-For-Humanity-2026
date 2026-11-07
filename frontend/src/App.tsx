import { useCallback, useEffect, useState } from "react";
import {
  getLayers,
  ingestAlert,
  plan,
  resetDemo,
  usingFixtures,
  type LayersResponse,
  type LngLat,
  type PlanResponse,
} from "./api/client";
import MapView from "./components/MapView";
import SearchPanel, { type SearchSettings } from "./components/SearchPanel";
import DirectionsList from "./components/DirectionsList";
import RerouteBanner from "./components/RerouteBanner";

// Default demo trip: Geisel Library -> Old Town
const DEFAULT_FROM: LngLat = [-117.2376, 32.8811];
const DEFAULT_TO: LngLat = [-117.1935, 32.75];
const DEMO_MODE = new URLSearchParams(location.search).has("demo") || usingFixtures;

export default function App() {
  const [layers, setLayers] = useState<LayersResponse | null>(null);
  const [route, setRoute] = useState<PlanResponse | null>(null);
  const [from, setFrom] = useState<LngLat | null>(DEFAULT_FROM);
  const [to, setTo] = useState<LngLat | null>(DEFAULT_TO);
  const [settings, setSettings] = useState<SearchSettings>({ text: "", maxGrade: 0.05, avoidUnverified: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshLayers = useCallback(() => getLayers().then(setLayers).catch((e) => setError(String(e))), []);
  useEffect(() => void refreshLayers(), [refreshLayers]);

  const runPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await plan({
        text: settings.text || undefined,
        from: from ?? undefined,
        to: to ?? undefined,
        max_grade: settings.maxGrade,
        avoid_unverified: settings.avoidUnverified,
      });
      setRoute(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [from, to, settings]);

  const simulateOutage = async () => {
    await ingestAlert({ demo_file: "old_town_elevator.json" });
    await refreshLayers();
    await runPlan();
  };

  const reset = async () => {
    await resetDemo();
    await refreshLayers();
    setRoute(null);
  };

  return (
    <div className="app">
      <aside className="panel" aria-label="Trip planner">
        <h1>Accessible Trip Planner</h1>
        <p className="subtitle">San Diego · UCSD Blue Line corridor{usingFixtures && " · fixture mode"}</p>

        <SearchPanel
          settings={settings}
          onChange={setSettings}
          from={from}
          to={to}
          onSubmit={runPlan}
          loading={loading}
        />

        {DEMO_MODE && (
          <div className="demo-controls">
            <button onClick={simulateOutage}>⛔ Simulate elevator outage</button>
            <button className="secondary" onClick={reset}>Reset demo</button>
          </div>
        )}

        {error && <p role="alert" className="error">{error}</p>}
        {route?.rerouted && route.reroute && <RerouteBanner reroute={route.reroute} />}
        {route && <DirectionsList route={route} />}
      </aside>

      <main className="map-wrap">
        <MapView
          layers={layers}
          route={route}
          from={from}
          to={to}
          onPickFrom={setFrom}
          onPickTo={setTo}
        />
      </main>
    </div>
  );
}
