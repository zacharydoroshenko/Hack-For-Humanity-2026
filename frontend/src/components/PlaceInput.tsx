import { useEffect, useId, useRef, useState } from "react";
import { PLACES, type Endpoint } from "../demoConfig";
import { searchPlaces, type Suggestion } from "../geo/services";
import { IconClose, IconCrosshair, IconPin } from "./Icons";

interface Props {
  label: string;
  value: Endpoint | null;
  onChange: (e: Endpoint | null) => void;
  picking: boolean;
  onPickOnMap: () => void;
  /** Shown for intermediate stops */
  onRemove?: () => void;
}

/** Quick local matches (instant), so common places appear before the network answers. */
function localMatches(q: string): Suggestion[] {
  const t = q.trim().toLowerCase();
  if (t.length < 2) return [];
  return PLACES.filter((p) => p.name.toLowerCase().includes(t) || p.aliases.some((a) => a.includes(t)))
    .slice(0, 3)
    .map((p) => ({ label: p.name, detail: "San Diego", coord: p.coord }));
}

/**
 * Search-as-you-type place box (any address or place in San Diego County), plus a "pick on map" button.
 * Keyboard: ↑/↓ to move, Enter to choose, Esc to close.
 */
export default function PlaceInput({ label, value, onChange, picking, onPickOnMap, onRemove }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState(value?.label ?? "");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const typed = useRef(false);

  useEffect(() => setText(value?.label ?? ""), [value]);

  // debounced search while the user is typing
  useEffect(() => {
    if (!typed.current) return;
    const q = text.trim();
    const local = localMatches(q);
    setResults(local);
    setActive(0);
    if (q.length < 3) {
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const remote = await searchPlaces(q, ctrl.signal);
        const seen = new Set(local.map((s) => s.label.toLowerCase()));
        setResults([...local, ...remote.filter((s) => !seen.has(s.label.toLowerCase()))].slice(0, 7));
      } catch {
        /* offline or aborted: keep local matches */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [text]);

  const choose = (s: Suggestion) => {
    typed.current = false;
    setText(s.label);
    setOpen(false);
    setResults([]);
    onChange({ coord: s.coord, label: s.label });
  };

  const showList = open && (results.length > 0 || loading);
  const placeholder = label === "Start" ? "Start: search any place or address" : label === "Destination" ? "Destination: search any place" : `${label}: search a place`;

  return (
    <div className="place-input">
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className="place-row">
        <div className="combo">
          <input
            id={id}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && results[active] ? `${id}-opt-${active}` : undefined}
            value={text}
            placeholder={placeholder}
            autoComplete="off"
            onChange={(e) => {
              typed.current = true;
              setText(e.target.value);
              setOpen(true);
            }}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                if (open && results[active]) {
                  e.preventDefault();
                  choose(results[active]);
                }
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
          />
          {showList && (
            <ul id={listId} role="listbox" className="suggestions" aria-label={`${label} suggestions`}>
              {results.map((s, i) => (
                <li
                  key={`${s.label}-${s.coord.join(",")}`}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={i === active ? "active" : ""}
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep focus so blur doesn't close the list first
                    choose(s);
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <IconPin size={16} />
                  <span className="sg-text">
                    <span className="sg-label">{s.label}</span>
                    {s.detail && <span className="sg-detail">{s.detail}</span>}
                  </span>
                </li>
              ))}
              {loading && <li className="sg-loading" aria-live="polite">Searching…</li>}
            </ul>
          )}
        </div>
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
