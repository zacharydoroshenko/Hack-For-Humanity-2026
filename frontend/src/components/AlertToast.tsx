import { useEffect } from "react";
import type { ClosureFeature } from "../api/client";
import AiChip from "./AiChip";
import { IconAlert, IconClose } from "./Icons";

interface Props {
  closure: ClosureFeature | null;
  onClose: () => void;
}

/** Pops up when a new MTS alert is ingested. */
export default function AlertToast({ closure, onClose }: Props) {
  useEffect(() => {
    if (!closure) return;
    const t = setTimeout(onClose, 9000);
    return () => clearTimeout(t);
  }, [closure, onClose]);

  return (
    <div className="toast-region" role="status" aria-live="assertive">
      {closure && (
        <div className="toast">
          <div className="toast-head">
            <span className="toast-kicker">
              <IconAlert size={18} /> New MTS alert
            </span>
            <button type="button" className="close-btn" onClick={onClose} aria-label="Dismiss alert">
              <IconClose size={18} />
            </button>
          </div>
          <p className="toast-title">{closure.properties.title}</p>
          {closure.properties.alternative && <p>Suggested: {closure.properties.alternative}</p>}
          {closure.properties.ai_generated && <AiChip source={closure.properties.raw_text} sourceLabel="Original MTS alert" />}
        </div>
      )}
    </div>
  );
}
