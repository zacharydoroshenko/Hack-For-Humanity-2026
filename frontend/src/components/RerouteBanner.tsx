import type { ClosureFeature, Leg, Reroute } from "../api/client";
import { formatMin } from "../format";
import { outageName, stationChanges } from "../reroute";
import AiChip from "./AiChip";
import { IconAlert } from "./Icons";

interface Props {
  reroute: Reroute;
  closures: ClosureFeature[];
  /** legs of the route currently shown */
  legs: Leg[];
  duration_min: number;
}

export default function RerouteBanner({ reroute, closures, legs, duration_min }: Props) {
  const causes = closures.filter((c) => reroute.cause_closure_ids.includes(c.properties.id));
  const source = causes.map((c) => c.properties.raw_text).filter(Boolean).join(" · ") || null;
  const changes = stationChanges(legs, reroute.previous_legs, causes);
  const before = reroute.previous_summary?.duration_min;

  return (
    <section className="reroute" role="status" aria-live="polite" aria-label="Route changed">
      <div className="reroute-head">
        <h2>
          <IconAlert size={22} /> Rerouted because of {causes.length ? causes.map(outageName).join(" + ") : "an MTS outage"}
        </h2>
        {reroute.ai_generated && <AiChip label="Explained by AI" source={source} sourceLabel="Original MTS alert" />}
      </div>

      {changes.length > 0 && (
        <div className="before-after" aria-label="What changed">
          <div className="ba-col ba-before">
            <span className="ba-title">Usual route{before != null && ` · ${formatMin(before)}`}</span>
            {changes.map((c, i) => (
              <span key={i} className={`ba-item ${c.blockedBy ? "blocked" : ""}`}>
                {c.what} <strong>{c.before}</strong>
                {c.blockedBy && <span className="ba-blocked"><IconAlert size={14} /> {c.blockedBy.properties.kind === "elevator_outage" ? "elevator out" : "closed"}</span>}
              </span>
            ))}
          </div>
          <span className="ba-arrow" aria-hidden="true">→</span>
          <div className="ba-col ba-after">
            <span className="ba-title">New route · {formatMin(duration_min)}</span>
            {changes.map((c, i) => (
              <span key={i} className="ba-item">
                {c.what} <strong>{c.after}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      <ol>
        {reroute.explanation.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </section>
  );
}
