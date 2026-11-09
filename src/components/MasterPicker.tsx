"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

/** A dropdown with tick boxes: choose one master or several. The ticked names show on the closed button. */
export function MasterPicker({
  masters,
  initial,
  name = "masterIds",
  onChange,
}: {
  masters: { id: number; name: string }[];
  initial: number[];
  name?: string;
  onChange?: () => void;
}) {
  const [picked, setPicked] = useState<number[]>(initial);
  const box = useRef<HTMLDetailsElement>(null);

  // close the list when the user taps somewhere else
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current?.open && !box.current.contains(e.target as Node)) box.current.open = false;
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const names = masters.filter((m) => picked.includes(m.id)).map((m) => m.name);

  return (
    <details ref={box} className="group relative">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-full border border-muted bg-paper-2 px-4 py-2 text-lg [&::-webkit-details-marker]:hidden">
        <span className={`min-w-0 flex-1 truncate ${names.length ? "" : "text-muted"}`}>
          {names.length ? names.join(", ") : "Choose masters"}
        </span>
        {names.length > 1 && <span className="rounded-full bg-accent-soft px-2 text-sm font-medium text-accent-deep">{names.length}</span>}
        <Icon name="chevron" className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute left-0 right-0 z-20 mt-2 space-y-1 rounded-2xl border border-rule-2 bg-paper-2 p-2 shadow-sm">
        {masters.length === 0 && <p className="p-2 text-base">No masters yet.</p>}
        {masters.map((m) => (
          <label key={m.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-lg hover:bg-paper-3">
            <input
              type="checkbox"
              name={name}
              value={m.id}
              checked={picked.includes(m.id)}
              onChange={(e) => {
                setPicked(e.target.checked ? [...picked, m.id] : picked.filter((x) => x !== m.id));
                onChange?.();
              }}
              className="checkbox checkbox-primary"
            />
            {m.name}
          </label>
        ))}
      </div>
    </details>
  );
}
