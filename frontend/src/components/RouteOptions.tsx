import type { ClosureFeature, Leg, RouteOption } from "../api/client";
import { outageName } from "../reroute";
import { formatMin } from "../format";
import { IconAlert, IconCheck, IconRoll, IconTransit, IconWarning } from "./Icons";

interface Props {
  options: RouteOption[];
  selected: number;
  onSelect: (i: number) => void;
  /** active closures from /layers, to name the outages an option avoids */
  closures: ClosureFeature[];
}

/** distinct construction zones a route rolls past (names from the leg warnings) */
function construction(legs: Leg[]): string[] {
  const names = legs.flatMap((l) =>
    l.mode === "walk" ? l.warnings.map((w) => w.message.match(/^MTS reports construction at (.+?);/)?.[1]).filter((x): x is string => !!x) : [],
  );
  return [...new Set(names)];
}

const short = (n: string) => n.replace(/ Station$/, "");

/** "Blue: UCSD Central Campus → Old Town" or "Roll only" */
function describe(legs: Leg[]): string {
  const rides = legs.filter((l) => l.mode === "transit");
  if (!rides.length) return "Roll only, no trolley";
  return rides
    .map((l) => (l.mode === "transit" ? `${l.route_short_name}: ${short(l.from_stop.name)} → ${short(l.to_stop.name)}` : ""))
    .join(" · ");
}

export default function RouteOptions({ options, selected, onSelect, closures }: Props) {
  if (options.length < 2) return null;
  return (
    <section className="route-options" aria-label="Route options">
      <h2 className="small-heading">{options.length} route options</h2>
      <div role="radiogroup" aria-label="Choose a route" className="route-option-list">
        {options.map((o, i) => {
          const active = i === selected;
          const hasTransit = o.legs.some((l) => l.mode === "transit");
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`route-option ${active ? "active" : ""} ${o.recommended ? "recommended" : ""}`}
              onClick={() => onSelect(i)}
            >
              <span className="ro-icon">{hasTransit ? <IconTransit size={22} /> : <IconRoll size={22} />}</span>
              <span className="ro-body">
                {o.recommended && (
                  <span className="ro-badge">
                    <IconCheck size={14} /> Recommended
                  </span>
                )}
                <span className="ro-top">
                  <span className="ro-label">{o.label}</span>
                  <span className="ro-time">{formatMin(o.summary.duration_min)}</span>
                </span>
                <span className="ro-desc">{describe(o.legs)}</span>
                <span className="ro-meta">{Math.round(o.summary.walk_m).toLocaleString()} m rolling</span>
                {o.recommended && o.recommended_reason && <span className="ro-why">{o.recommended_reason}</span>}
                <span className="ro-chips">
                  {(o.avoided_closure_ids ?? [])
                    .map((id) => closures.find((c) => c.properties.id === id))
                    .filter((c): c is ClosureFeature => !!c)
                    .map((c) => (
                      <span key={c.properties.id} className="chip chip-avoids">
                        <IconAlert size={13} /> Avoids: {outageName(c)}
                      </span>
                    ))}
                  {construction(o.legs).map((name) => (
                    <span key={name} className="chip chip-passes" title="MTS construction closure next to the roll">
                      <IconWarning size={13} /> Passes construction: {name}
                    </span>
                  ))}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
