import { useCallback, useEffect, useRef, useState } from "react";
import {
  getHealth,
  getLayers,
  ingestAlert,
  plan,
  resetDemo,
  usingFixtures,
  type ClosureFeature,
  type HealthResponse,
  type LayersResponse,
  type LngLat,
  type TravelMode,
} from "./api/client";
import { HAPPY_PATH, PLACES, type Endpoint } from "./demoConfig";
import logoUrl from "./assets/logo.svg";
import MapView from "./components/MapView";
import SearchPanel, { type PickMode, type SearchSettings } from "./components/SearchPanel";
import ModeTabs, { MODES, type ModeResult } from "./components/ModeTabs";
import DirectionsList from "./components/DirectionsList";
import RerouteBanner from "./components/RerouteBanner";
import DemoControls from "./components/DemoControls";
import AlertToast from "./components/AlertToast";
import Legend from "./components/Legend";
import { IconAlert } from "./components/Icons";

const DEMO_MODE = usingFixtures || new URLSearchParams(location.search).has("demo");
const DEFAULT_SETTINGS: SearchSettings = { maxGrade: HAPPY_PATH.maxGrade, avoidUnverified: false, showAllMapDetails: false };

function nearestPlaceLabel(p: LngLat): string {
  const near = PLACES.find((x) => Math.hypot(x.coord[0] - p[0], x.coord[1] - p[1]) < 0.0015);
  return near?.name ?? `Dropped pin (${p[1].toFixed(4)}, ${p[0].toFixed(4)})`;
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [layers, setLayers] = useState<LayersResponse | null>(null);
  const [results, setResults] = useState<Partial<Record<TravelMode, ModeResult>>>({});
  const [mode, setMode] = useState<TravelMode>("transit");
  const [from, setFrom] = useState<Endpoint | null>(HAPPY_PATH.from);
  const [to, setTo] = useState<Endpoint | null>(HAPPY_PATH.to);
  const [settings, setSettings] = useState<SearchSettings>(DEFAULT_SETTINGS);
  const [pickMode, setPickMode] = useState<PickMode>(null);
  const [focusedLeg, setFocusedLeg] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [alertBusy, setAlertBusy] = useState(false);
  const [toast, setToast] = useState<ClosureFeature | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = results[mode];
  const route = current && !("error" in current) ? current : null;
  const hasResults = Object.keys(results).length > 0;

  const refreshLayers = useCallback(async () => {
    try {
      setLayers(await getLayers());
    } catch (e) {
      setError(`Couldn't load map data. ${String(e)}`);
    }
  }, []);

  useEffect(() => {
    refreshLayers();
    getHealth().then(setHealth).catch(() => setHealth({ ok: false, gemini: false }));
  }, [refreshLayers]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPickMode(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Plan every mode in parallel so the tabs can show times side by side. */
  const runPlan = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    setFocusedLeg(null);
    const entries = await Promise.all(
      MODES.map(async ({ mode: m }): Promise<[TravelMode, ModeResult]> => {
        try {
          return [m, await plan({ from: from.coord, to: to.coord, mode: m, max_grade: settings.maxGrade, avoid_unverified: settings.avoidUnverified })];
        } catch (e) {
          return [m, { error: String(e).replace(/^Error: /, "") }];
        }
      }),
    );
    setResults(Object.fromEntries(entries));
    setLoading(false);
  }, [from, to, settings.maxGrade, settings.avoidUnverified]);

  const runPlanRef = useRef(runPlan);
  runPlanRef.current = runPlan;

  const onPick = (which: "from" | "to", p: LngLat) => {
    const ep = { coord: p, label: nearestPlaceLabel(p) };
    if (which === "from") setFrom(ep);
    else setTo(ep);
    setPickMode(which === "from" && !to ? "to" : null);
  };

  const simulate = async (file: string) => {
    setAlertBusy(true);
    setError(null);
    try {
      const { closure } = await ingestAlert({ demo_file: file });
      setToast(closure);
      await refreshLayers();
      if (hasResults) {
        await runPlanRef.current();
        setMode("transit"); // outages affect the trolley; show that tab
      }
    } catch (e) {
      setError(`Alert replay failed. ${String(e)}`);
    } finally {
      setAlertBusy(false);
    }
  };

  const reset = async () => {
    await resetDemo();
    setToast(null);
    setResults({});
    setMode("transit");
    setFocusedLeg(null);
    setFrom(HAPPY_PATH.from);
    setTo(HAPPY_PATH.to);
    setSettings(DEFAULT_SETTINGS);
    await refreshLayers();
  };

  const activeOutages = layers?.closures.features.filter((c) => c.properties.source === "mts_alerts") ?? [];
  const statusText = usingFixtures
    ? "Demo data"
    : health == null
      ? "Connecting…"
      : health.ok
        ? "Live"
        : "Backend offline";

  return (
    <div className="app">
      <a href="#planner" className="skip-link">Skip to trip planner</a>
      <aside className="panel" id="planner" aria-label="Trip planner">
        <header className="app-header">
          <img src={logoUrl} alt="SafeRoute" className="logo" />
          <span className={`status-pill ${usingFixtures ? "demo" : health?.ok ? "ok" : "down"}`}>{statusText}</span>
        </header>
        <p className="tagline">Accessible trips in San Diego that reroute around elevator outages.</p>

        {activeOutages.length > 0 && (
          <p className="outage-count" role="status">
            <IconAlert size={18} /> {activeOutages.length} active MTS outage{activeOutages.length === 1 ? "" : "s"} nearby
          </p>
        )}

        <SearchPanel
          settings={settings}
          onChange={setSettings}
          from={from}
          to={to}
          onFrom={setFrom}
          onTo={setTo}
          pickMode={pickMode}
          onPickMode={setPickMode}
          onSubmit={runPlan}
          loading={loading}
        />

        <ModeTabs
          selected={mode}
          onSelect={(m) => {
            setMode(m);
            setFocusedLeg(null);
          }}
          results={results}
          loading={loading}
        />

        {error && <p role="alert" className="error">{error}</p>}
        {current && "error" in current && (
          <p role="alert" className="error">This option isn't available right now. {current.error}</p>
        )}

        {route?.rerouted && route.reroute && <RerouteBanner reroute={route.reroute} closures={layers?.closures.features ?? []} />}
        {route && <DirectionsList route={route} focusedLeg={focusedLeg} onFocusLeg={setFocusedLeg} />}
        {!hasResults && !loading && (
          <p className="empty-state">
            Choose a start and destination to compare accessible options. Curb-ramp data covers City "Mobility Element"
            streets only. Sidewalks without accessibility data are marked as unverified.
          </p>
        )}

        {DEMO_MODE && <DemoControls onSimulate={simulate} onReset={reset} busy={alertBusy} />}
      </aside>

      <main className="map-wrap" aria-label="Map">
        <MapView
          layers={layers}
          route={route}
          from={from}
          to={to}
          pickMode={pickMode}
          onPick={onPick}
          focusedLeg={focusedLeg}
          showAll={settings.showAllMapDetails}
        />
        <Legend />
        <AlertToast closure={toast} onClose={() => setToast(null)} />
        {(loading || alertBusy) && (
          <div className="map-busy" role="status">
            {alertBusy ? "Reading the MTS alert…" : "Finding accessible routes…"}
          </div>
        )}
      </main>
    </div>
  );
}
