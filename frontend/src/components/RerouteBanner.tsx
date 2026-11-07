import type { Reroute } from "../api/client";

export default function RerouteBanner({ reroute }: { reroute: Reroute }) {
  return (
    <section className="reroute" role="status" aria-live="polite">
      <h2>
        ⛔ Rerouted {reroute.ai_generated && <span className="ai-chip">AI-explained</span>}
      </h2>
      <ol>
        {reroute.explanation.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </section>
  );
}
