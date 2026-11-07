import type { ClosureFeature, Reroute } from "../api/client";
import AiChip from "./AiChip";
import { IconAlert } from "./Icons";

interface Props {
  reroute: Reroute;
  closures: ClosureFeature[];
}

export default function RerouteBanner({ reroute, closures }: Props) {
  const causes = closures.filter((c) => reroute.cause_closure_ids.includes(c.properties.id));
  const source = causes.map((c) => c.properties.raw_text).filter(Boolean).join(" · ") || null;

  return (
    <section className="reroute" role="status" aria-live="polite" aria-label="Route changed">
      <div className="reroute-head">
        <h2>
          <IconAlert size={22} /> Your route changed
        </h2>
        {reroute.ai_generated && <AiChip label="Explained by AI" source={source} sourceLabel="Original MTS alert" />}
      </div>
      <ol>
        {reroute.explanation.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </section>
  );
}
