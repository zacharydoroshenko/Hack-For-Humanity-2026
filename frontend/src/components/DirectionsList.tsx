import type { Leg, PlanResponse } from "../api/client";
import { formatMin } from "../format";
import { IconCar, IconInfo, IconRideshare, IconRoll, IconTransit, IconWarning } from "./Icons";

interface Props {
  route: PlanResponse;
  focusedLeg: number | null;
  onFocusLeg: (i: number | null) => void;
}

const stationName = (n: string) => n.replace(/ Station$/, "");

function LegIcon({ leg }: { leg: Leg }) {
  switch (leg.mode) {
    case "walk":
      return <IconRoll size={22} />;
    case "transit":
      return <IconTransit size={22} />;
    case "rideshare":
      return <IconRideshare size={22} />;
    case "drive":
      return <IconCar size={22} />;
  }
}

function legTitle(leg: Leg) {
  switch (leg.mode) {
    case "walk":
      return <>Roll {Math.round(leg.distance_m).toLocaleString()} m</>;
    case "transit":
      return (
        <>
          <span className="line-badge" style={{ background: `#${leg.route_color}` }}>{leg.route_short_name}</span>{" "}
          {stationName(leg.from_stop.name)} to {stationName(leg.to_stop.name)}
        </>
      );
    case "rideshare":
      return <>Accessible rideshare · {(leg.distance_m / 1000).toFixed(1)} km</>;
    case "drive":
      return <>Drive {(leg.distance_m / 1000).toFixed(1)} km</>;
  }
}

export default function DirectionsList({ route, focusedLeg, onFocusLeg }: Props) {
  const { summary } = route;
  const notes = route.legs.reduce((n, l) => n + ("warnings" in l ? l.warnings.length : 0), 0);
  const hasTransit = route.legs.some((l) => l.mode === "transit");

  return (
    <section className="directions" aria-label="Trip directions">
      <div className="summary-card">
        <div className="summary-big">{formatMin(summary.duration_min)}</div>
        <div className="summary-meta">
          {Math.round(summary.walk_m).toLocaleString()} m rolling
          {hasTransit && ` · ${summary.transfers} transfer${summary.transfers === 1 ? "" : "s"}`}
          {notes > 0 && ` · ${notes} note${notes === 1 ? "" : "s"}`}
        </div>
      </div>

      <ol className="legs">
        {route.legs.map((leg, i) => {
          const focused = focusedLeg === i;
          return (
            <li key={i} className={`leg leg-${leg.mode} ${focused ? "focused" : ""}`}>
              <button
                type="button"
                className="leg-head"
                aria-pressed={focused}
                onClick={() => onFocusLeg(focused ? null : i)}
                title="Show this part on the map"
              >
                <span className="leg-icon"><LegIcon leg={leg} /></span>
                <span className="leg-title">{legTitle(leg)}</span>
                <span className="leg-time">{formatMin(leg.duration_min)}</span>
              </button>

              <ul className="steps">
                {leg.mode === "transit" ? (
                  <>
                    <li>Board the {leg.route_short_name} Line at {leg.from_stop.name}</li>
                    <li>Ride {Math.round(leg.duration_min)} min and get off at {leg.to_stop.name}</li>
                    <li className="muted">Trolleys have low-floor, step-free boarding</li>
                  </>
                ) : (
                  leg.steps.map((s, j) => (
                    <li key={j}>
                      {s.instruction}
                      {s.distance_m > 0 && leg.mode === "walk" && <span className="muted"> · {Math.round(s.distance_m)} m</span>}
                    </li>
                  ))
                )}
                {"warnings" in leg &&
                  leg.warnings.map((w, j) => (
                    <li key={`w${j}`} className="note note-warning">
                      <IconWarning size={16} /> <span>{w.message}</span>
                    </li>
                  ))}
                {"note" in leg && leg.note && (
                  <li className="note note-info">
                    <IconInfo size={16} /> <span>{leg.note}</span>
                  </li>
                )}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
