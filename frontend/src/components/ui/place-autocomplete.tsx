"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Suggestion = { label: string };

/**
 * Address input that requires picking a resolved place.
 *
 * Free text was the bug: "sfsf" is a real village in Algeria, so validating
 * after the fact could never work. Here the value is only ever something the
 * geocoder returned, which removes the failure mode instead of detecting it.
 *
 * Typing still updates the field (people paste addresses, and half-typed input
 * must not be destroyed) — the guarantee is at the point of *selection*, plus
 * the backend's own check at confirm.
 */
export function PlaceAutocomplete({
  value,
  onChange,
  placeholder,
  className,
  variant = "field",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  /**
   * "field"      — sits inside a .cp-field wrapper, which draws the border and
   *                label. Uses .cp-control (transparent, borderless).
   * "standalone" — draws its own box, for rows with no .cp-field around them.
   *
   * This exists because .cp-control sets `background: transparent; border: 0`
   * and a transparent placeholder, and it is unlayered CSS — so it beats any
   * Tailwind utility passed via className. Used standalone it rendered a fully
   * invisible input, which is how the Calls stage lost its location field.
   */
  variant?: "field" | "standalone";
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  // Set when a suggestion is chosen, so we don't immediately re-query the text
  // we just wrote back into the field.
  const justPicked = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    // Debounced: the geocoder is a shared public instance, and a request per
    // keystroke would be both slow and rude.
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.suggestPlaces(q);
        if (!alive) return;
        setSuggestions(res);
        setActive(-1);
        if (res.length) setOpen(true);
      } catch {
        if (alive) setSuggestions([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 320);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(s: Suggestion) {
    justPicked.current = true;
    onChange(s.label);
    setOpen(false);
    setSuggestions([]);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        className={cn(
          variant === "standalone"
            ? "flex h-9 w-full min-w-0 rounded-md border border-line-strong bg-paper-raised px-3 py-1 text-sm text-ink shadow-sm outline-none placeholder:text-ink-muted/70 focus-visible:border-action focus-visible:ring-2 focus-visible:ring-action/40"
            : "cp-control",
          className
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {loading && (
        <Loader2 className="pointer-events-none absolute right-0 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-ink-muted" />
      )}
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          // z-50 so it clears the glass card below it; the field sits inside a
          // stacking context created by the card's backdrop-filter.
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-60 overflow-auto rounded-lg border border-line-strong bg-paper-raised py-1 shadow-xl"
        >
          {suggestions.map((s, i) => (
            <li key={s.label}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                // mousedown, not click: the input's blur would close the list
                // before a click ever lands.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink cp-transition",
                  i === active ? "bg-action/15" : "hover:bg-paper"
                )}
              >
                <MapPin className="size-3.5 shrink-0 text-ink-muted" />
                <span className="truncate">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
