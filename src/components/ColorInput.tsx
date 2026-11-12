"use client";

import { useState } from "react";
import { colourName } from "@/lib/colour-name";
import { normalizeHex } from "@/lib/items";

/**
 * A colour field: tap the swatch to pick a colour, and the colour is shown by its name ("Maroon"), never by a code.
 * The picked colour is still saved exactly (as a HEX value) in a hidden box.
 */
export function ColorInput({ name, value, compact = false }: { name: string; value: string; compact?: boolean }) {
  const start = normalizeHex(value);
  const [hex, setHex] = useState(start);
  const label = hex ? colourName(hex) : compact ? "Pick a colour" : "Tap the circle to pick a colour";

  return (
    <div className="flex items-center gap-3">
      <input name={name} type="hidden" value={hex} />
      <input
        type="color"
        aria-label="Pick a colour"
        value={hex || "#FFFFFF"}
        onChange={(e) => setHex(e.target.value.toUpperCase())}
        className={`${compact ? "h-10 w-12" : "h-12 w-14"} shrink-0 cursor-pointer rounded-xl border border-rule-2 bg-paper-2 p-1`}
      />
      <span className={`min-w-0 flex-1 text-base ${hex ? "font-medium" : "text-muted"}`}>{label}</span>
      {hex && (
        <button type="button" onClick={() => setHex("")} className="btn btn-quiet h-auto min-h-10 px-3 py-1 text-sm">
          Clear
        </button>
      )}
    </div>
  );
}
