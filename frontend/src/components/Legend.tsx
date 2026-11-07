import { useState } from "react";
import { IconChevron } from "./Icons";
import { MARKER_SVG } from "./mapMarkers";

const Item = ({ svg, label }: { svg: string; label: string }) => (
  <li>
    <span className="legend-sym" dangerouslySetInnerHTML={{ __html: svg }} />
    {label}
  </li>
);

export default function Legend() {
  const [open, setOpen] = useState(false);
  return (
    <section className={`legend ${open ? "open" : ""}`} aria-label="Map legend">
      <button type="button" className="legend-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Legend <IconChevron size={16} style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </button>
      {open && (
        <ul>
          <Item svg={MARKER_SVG.start} label="Start" />
          <Item svg={MARKER_SVG.end} label="Destination" />
          <Item svg={MARKER_SVG.station} label="Trolley station" />
          <Item svg={MARKER_SVG.outage} label="Elevator outage / closure" />
          <Item svg={MARKER_SVG.warning} label="Steep or reported hazard" />
          <Item svg={MARKER_SVG.ramp} label="Curb ramp issue" />
          <li><span className="legend-line walk" /> Rolling</li>
          <li><span className="legend-line trolley" /> Blue Line trolley</li>
          <li><span className="legend-line car" /> Car / rideshare</li>
        </ul>
      )}
    </section>
  );
}
