import { useEffect, useId, useState } from "react";
import { PLACES, type Endpoint } from "../demoConfig";
import { IconClose, IconCrosshair } from "./Icons";

interface Props {
  label: string;
  value: Endpoint | null;
  onChange: (e: Endpoint | null) => void;
  picking: boolean;
  onPickOnMap: () => void;
  /** Shown for intermediate stops */
  onRemove?: () => void;
}

/** Text field with place suggestions, plus a "pick on map" button. Keyboard-friendly alternative to map clicks. */
export default function PlaceInput({ label, value, onChange, picking, onPickOnMap, onRemove }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState(value?.label ?? "");

  useEffect(() => setText(value?.label ?? ""), [value]);

  const commit = (t: string) => {
    const p = PLACES.find((x) => x.name.toLowerCase() === t.trim().toLowerCase());
    if (p) onChange({ coord: p.coord, label: p.name });
  };

  return (
    <div className="place-input">
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className="place-row">
        <input
          id={id}
          list={listId}
          value={text}
          placeholder={label}
          autoComplete="off"
          onChange={(e) => {
            setText(e.target.value);
            commit(e.target.value);
          }}
          onBlur={() => commit(text)}
        />
        <datalist id={listId}>
          {PLACES.map((p) => (
            <option key={p.name} value={p.name} />
          ))}
        </datalist>
        <button
          type="button"
          className={`icon-btn ${picking ? "active" : ""}`}
          aria-pressed={picking}
          onClick={onPickOnMap}
          title={`Pick ${label.toLowerCase()} on the map`}
        >
          <IconCrosshair size={20} />
          <span className="sr-only">Pick {label.toLowerCase()} on the map</span>
        </button>
        {onRemove && (
          <button type="button" className="icon-btn remove-btn" onClick={onRemove} title={`Remove ${label.toLowerCase()}`}>
            <IconClose size={18} />
            <span className="sr-only">Remove {label.toLowerCase()}</span>
          </button>
        )}
      </div>
    </div>
  );
}
