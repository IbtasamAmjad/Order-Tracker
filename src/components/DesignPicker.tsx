"use client";

import { useState } from "react";
import { select } from "./ui";

export type DesignOption = { id: number; name: string; photoIds: number[] };

/**
 * The "Design number" box of an item on the customer form, as a dropdown of the designs the office added on the
 * Design Category page. Choosing one fills the box and, when the form is saved, its pictures are copied onto the item.
 * A value that is not in the library (typed earlier, or the customer's own design number) stays as a choice of its own.
 */
export function DesignNumberSelect({
  name,
  value,
  designs,
  label,
  missing,
}: {
  name: string; // form field, "v:<item key>:<field key>"
  value: string;
  designs: DesignOption[];
  label: string;
  missing?: boolean;
}) {
  const [now, setNow] = useState(value);
  const chosen = designs.find((d) => d.name.toLowerCase() === now.trim().toLowerCase());
  return (
    <div>
      <select name={name} value={now} onChange={(e) => setNow(e.target.value)} className={select} aria-label={label} aria-invalid={missing || undefined}>
        <option value="">-</option>
        {!chosen && now.trim() !== "" && <option value={now}>{now}</option>}
        {designs.map((d) => (
          <option key={d.id} value={d.name}>
            {d.name}
          </option>
        ))}
      </select>
      {chosen && chosen.photoIds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {chosen.photoIds.map((pid) => (
            <a key={pid} href={`/api/admin/designs/${pid}`} target="_blank" rel="noreferrer" className="block h-14 w-14 overflow-hidden rounded-xl border border-rule bg-paper-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/admin/designs/${pid}?thumb=1`} alt={chosen.name} className="h-full w-full object-cover" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
