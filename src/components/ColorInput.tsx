"use client";

import { useState } from "react";
import { normalizeHex } from "@/lib/items";
import { input } from "./ui";

/** A HEX color code box with a swatch beside it. Type a code like #1F69D1, or pick the color from the swatch. */
export function ColorInput({ name, value }: { name: string; value: string }) {
  const [text, setText] = useState(value);
  const hex = normalizeHex(text);
  const bad = text.trim() !== "" && !hex;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label="Pick a color"
          value={hex || "#FFFFFF"}
          onChange={(e) => setText(e.target.value.toUpperCase())}
          className="h-12 w-14 shrink-0 cursor-pointer rounded-xl border border-rule-2 bg-paper-2 p-1"
        />
        <input
          name={name}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="#1F69D1"
          maxLength={7}
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={bad}
          className={`${input} min-w-0 flex-1 font-mono`}
        />
      </div>
      {bad && <p className="text-base font-medium text-thread">Use a HEX code like #1F69D1 (3 or 6 letters and numbers).</p>}
    </div>
  );
}
