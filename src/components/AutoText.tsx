"use client";

import { useEffect, useRef } from "react";

/**
 * A text box that grows with what is typed. Enter starts a new line, and pasted lines stay as separate lines (a
 * one-line input would join them), so each line can be its own instruction. It is the same value and field name as
 * a normal box, so saving does not change.
 */
export function AutoText({
  name,
  defaultValue,
  className,
  ariaLabel,
  invalid,
}: {
  name: string;
  defaultValue?: string;
  className?: string;
  ariaLabel?: string;
  invalid?: boolean;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 3}px`; // + the border
  };
  useEffect(fit, []);
  return (
    <textarea
      ref={box}
      name={name}
      rows={1}
      defaultValue={defaultValue}
      onInput={fit}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      className={`textarea w-full min-h-10 resize-none overflow-hidden !rounded-[1.375rem] px-4 py-2 text-base leading-snug ${className ?? ""}`}
    />
  );
}
