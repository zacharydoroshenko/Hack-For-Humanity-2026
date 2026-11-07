import type { Leg, RouteOption } from "../api/client";
import { formatMin } from "../format";
import { IconRoll, IconTransit } from "./Icons";

interface Props {
  options: RouteOption[];
  selected: number;
  onSelect: (i: number) => void;
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

export default function RouteOptions({ options, selected, onSelect }: Props) {
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
              className={`route-option ${active ? "active" : ""}`}
              onClick={() => onSelect(i)}
            >
              <span className="ro-icon">{hasTransit ? <IconTransit size={22} /> : <IconRoll size={22} />}</span>
              <span className="ro-body">
                <span className="ro-top">
                  <span className="ro-label">{o.label}</span>
                  <span className="ro-time">{formatMin(o.summary.duration_min)}</span>
                </span>
                <span className="ro-desc">{describe(o.legs)}</span>
                <span className="ro-meta">{Math.round(o.summary.walk_m).toLocaleString()} m rolling</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
