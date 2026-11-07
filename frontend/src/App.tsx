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
  type PlanResponse,
  type RouteOption,
} from "./api/client";
import { DEMO_ALERT_OPTIONS, PLACES, type Endpoint } from "./demoConfig";
import logoUrl from "./assets/logo.svg";
import MapView from "./components/MapView";
import SearchPanel, { type PickMode, type SearchSettings } from "./components/SearchPanel";
import DirectionsList from "./components/DirectionsList";
import RerouteBanner from "./components/RerouteBanner";
import RouteOptions from "./components/RouteOptions";
import { reverseGeocode } from "./geo/services";
import { changedLegIndices, droppedPaths, outageName } from "./reroute";
import AlertToast from "./components/AlertToast";
import Legend from "./components/Legend";
import { IconAlert } from "./components/Icons";

const DEMO_MODE = usingFixtures || new URLSearchParams(location.search).has("demo");
const DEFAULT_SETTINGS: SearchSettings = { maxGrade: 0.05, avoidUnverified: false, showAllMapDetails: false };

function nearestPlaceLabel(p: LngLat): string {
  const near = PLACES.find((x) => Math.hypot(x.coord[0] - p[0], x.coord[1] - p[1]) < 0.0015);
  return near?.name ?? "Dropped pin";
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [layers, setLayers] = useState<LayersResponse | null>(null);
  const [route, setRoute] = useState<PlanResponse | null>(null);
  const [from, setFrom] = useState<Endpoint | null>(null);
  const [to, setTo] = useState<Endpoint | null>(null);
  const [via, setVia] = useState<(Endpoint | null)[]>([]);
  const [selectedOption, setSelectedOption] = useState(0);
  const [settings, setSettings] = useState<SearchSettings>(DEFAULT_SETTINGS);
  const [pickMode, setPickMode] = useState<PickMode>(null);
  const [focusedLeg, setFocusedLeg] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [alertBusy, setAlertBusy] = useState(false);
  const [toast, setToast] = useState<ClosureFeature | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasResults = route != null;

  const refreshLayers = useCallback(async () => {
    try {
      setLayers(await getLayers());
    } catch (e) {
      setError(`Couldn't load map data. ${String(e)}`);
    }
  }, []);

  useEffect(() => {
    // Demo mode: every page load starts clean, so a refresh puts the demo back at the beginning
    // (clears alerts replayed earlier, including on the backend in `npm run demo`).
    (DEMO_MODE ? resetDemo().catch(() => undefined) : Promise.resolve()).then(refreshLayers);
    getHealth().then(setHealth).catch(() => setHealth({ ok: false, gemini: false }));
  }, [refreshLayers]);


  /** Transit trip (walk/roll + Blue Line). The planner returns a roll-only route when the trolley doesn't help. */
  const runPlan = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    setFocusedLeg(null);
    try {
      const stops = via.filter((v): v is Endpoint => v !== null).map((v) => v.coord);
      const r = await plan({
          from: from.coord,
          to: to.coord,
          ...(stops.length ? { via: stops } : {}),
          max_grade: settings.maxGrade,
          avoid_unverified: settings.avoidUnverified,
        });
      // keep the user's chosen option (matched by label) when the route is replanned, e.g. after an alert
      const prevLabel = selectedLabelRef.current;
      // ...unless an alert rerouted the trip: then show the recommended route the banner explains
      const keep = prevLabel && !r.rerouted ? (r.options ?? []).findIndex((o) => o.label === prevLabel) : -1;
      setRoute(r);
      const recommended = (r.options ?? []).findIndex((o) => o.recommended);
      setSelectedOption(keep >= 0 ? keep : Math.max(0, recommended));
    } catch (e) {
      setError(String(e).replace(/^Error: /, ""));
    } finally {
      setLoading(false);
    }
  }, [from, to, via, settings.maxGrade, settings.avoidUnverified]);

  const selectedLabelRef = useRef<string | null>(null);
  const runPlanRef = useRef(runPlan);
  runPlanRef.current = runPlan;

  const onPick = (which: Exclude<PickMode, null>, p: LngLat) => {
    const ep = { coord: p, label: nearestPlaceLabel(p) };
    // replace the placeholder label with the real address once it's known
    reverseGeocode(p).then((name) => {
      if (!name) return;
      const named = { coord: p, label: name };
      const same = (e: Endpoint | null) => (e && e.coord === p ? named : e);
      if (which === "from") setFrom(same);
      else if (which === "to") setTo(same);
      else setVia((v) => v.map(same));
    });
    if (which === "from") setFrom(ep);
    else if (which === "to") setTo(ep);
    else setVia((v) => v.map((x, i) => (i === which ? ep : x)));
    setPickMode(which === "from" && !to ? "to" : null);
  };

  // Route options from the backend (best first); older backends send a single route
  const options: RouteOption[] = route
    ? route.options?.length
      ? route.options
      : [{ id: "only", label: "Recommended", summary: route.summary, legs: route.legs }]
    : [];
  const selected = options[selectedOption] ?? options[0] ?? null;
  selectedLabelRef.current = selected?.label ?? null;
  // what the outage changed, for the banner, directions and map
  const closuresNow = layers?.closures.features ?? [];
  const causes = route?.rerouted && route.reroute ? closuresNow.filter((c) => route.reroute!.cause_closure_ids.includes(c.properties.id)) : [];
  const because = causes.length ? causes.map(outageName).join(" + ") : null;
  const prevLegs = route?.rerouted ? route.reroute?.previous_legs : undefined;
  const changed = selected ? changedLegIndices(selected.legs, prevLegs) : new Set<number>();
  const blocked = selected && prevLegs && because ? { paths: droppedPaths(selected.legs, prevLegs), because } : null;

  const selectOption = (i: number) => {
    setSelectedOption(i);
    setFocusedLeg(null);
  };

  const simulate = async (file: string) => {
    setAlertBusy(true);
    setError(null);
    try {
      const { closure } = await ingestAlert({ demo_file: file });
      setToast(closure);
      await refreshLayers();
      if (hasResults) await runPlanRef.current();
    } catch (e) {
      setError(`Alert replay failed. ${String(e)}`);
    } finally {
      setAlertBusy(false);
    }
  };

  // ── live-event hotkeys (1-9): each replays a simulated alert. Esc cancels picking a point on the map. ──
  const simulateRef = useRef(simulate);
  simulateRef.current = simulate;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setPickMode(null);
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (!DEMO_MODE || typing || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : -1;
      if (idx < 0 || !DEMO_ALERT_OPTIONS[idx]) return;
      e.preventDefault();
      simulateRef.current(DEMO_ALERT_OPTIONS[idx].file);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeOutages = layers?.closures.features.filter((c) => c.properties.source === "mts_alerts" && c.properties.severity === "blocking") ?? [];
  const statusText = health == null ? "Connecting…" : health.ok ? "Live" : "Backend offline";

  return (
    <div className="app">
      <a href="#planner" className="skip-link">Skip to trip planner</a>
      <aside className="panel" id="planner" aria-label="Trip planner">
        <header className="app-header">
          <img src={logoUrl} alt="SafeRoute" className="logo" />
          {!usingFixtures && <span className={`status-pill ${health?.ok ? "ok" : "down"}`}>{statusText}</span>}
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
          via={via}
          onVia={setVia}
          pickMode={pickMode}
          onPickMode={setPickMode}
          onSubmit={runPlan}
          loading={loading}
        />

        {error && <p role="alert" className="error">{error}</p>}

        {route?.rerouted && route.reroute && selected && (
          <RerouteBanner reroute={route.reroute} closures={closuresNow} legs={selected.legs} duration_min={selected.summary.duration_min} />
        )}
        {route && <RouteOptions options={options} selected={selectedOption} onSelect={selectOption} closures={closuresNow} />}
        {route && selected && (
          <DirectionsList
            route={{ ...route, summary: selected.summary, legs: selected.legs }}
            focusedLeg={focusedLeg}
            onFocusLeg={setFocusedLeg}
            changedLegs={changed}
            changedBecause={because}
          />
        )}
        {!hasResults && !loading && (
          <p className="empty-state">
            Choose a start and destination to find an accessible route. Curb-ramp data covers City "Mobility Element"
            streets only. Sidewalks without accessibility data are marked as unverified.
          </p>
        )}

      </aside>

      <main className="map-wrap" aria-label="Map">
        <MapView
          layers={layers}
          route={selected}
          alternatives={options.map((option, index) => ({ index, option })).filter((a) => a.index !== selectedOption)}
          onSelectAlternative={selectOption}
          blocked={blocked}
          via={via}
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
            {alertBusy ? "Reading a new live alert…" : "Finding an accessible route…"}
          </div>
        )}
      </main>
    </div>
  );
}
