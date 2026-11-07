import type { PlanResponse } from "../api/client";

export default function DirectionsList({ route }: { route: PlanResponse }) {
  const { summary } = route;
  return (
    <section className="directions" aria-label="Directions">
      <h2>
        {Math.round(summary.duration_min)} min · {Math.round(summary.walk_m)} m rolling
      </h2>
      {route.parsed_request?.ai_generated && (
        <p className="hint">
          <span className="ai-chip">AI-interpreted</span> max slope {(route.parsed_request.max_grade * 100).toFixed(1)}%
          {route.parsed_request.avoid_unverified && ", verified sidewalks only"}
        </p>
      )}
      <ol>
        {route.legs.map((leg, i) =>
          leg.mode === "walk" ? (
            <li key={i}>
              <strong>🦽 Roll {Math.round(leg.distance_m)} m</strong> ({Math.round(leg.duration_min)} min)
              <ul>
                {leg.steps.map((s, j) => (
                  <li key={j}>{s.instruction}</li>
                ))}
                {leg.warnings.map((w, j) => (
                  <li key={`w${j}`} className="warning">⚠️ {w.message}</li>
                ))}
              </ul>
            </li>
          ) : (
            <li key={i}>
              <strong>🚊 {leg.route_short_name} Line</strong>: {leg.from_stop.name} → {leg.to_stop.name} (
              {Math.round(leg.duration_min)} min)
            </li>
          ),
        )}
      </ol>
    </section>
  );
}
