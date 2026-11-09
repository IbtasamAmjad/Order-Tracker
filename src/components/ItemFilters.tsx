"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DUE_FILTERS, STATUS_FILTERS } from "@/lib/item-filter-options";
import { btnPrimary, input, select } from "./ui";

/**
 * Search box, item dropdown, status dropdown and due-date dropdown for the item search. A choice in a dropdown applies at
 * once; the search box applies a moment after you stop typing (or when you press Enter or Search).
 */
export function ItemFilters({
  action,
  types,
  q,
  type,
  status,
  due,
  large = false,
}: {
  action: string;
  types: string[];
  q?: string;
  type?: string;
  status?: string;
  due?: string;
  large?: boolean; // the master bigger controls
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const size = large ? "!min-h-14 text-lg" : "";
  const active = !!(q || type || status || due);

  /** Go to the same page with what is in the form now (empty choices are left out of the address, except status). */
  function apply(replace = false) {
    if (!form.current) return;
    const params = new URLSearchParams();
    // "status" is kept even when empty: on the report page an empty status means "any", not the default
    for (const [k, v] of new FormData(form.current).entries()) if (typeof v === "string" && (v.trim() || k === "status")) params.set(k, v.trim());
    const url = `${action}${params.size ? `?${params}` : ""}`;
    if (replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <form
      ref={form}
      action={action}
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]"
      role="search"
    >
      <input
        name="q"
        defaultValue={q ?? ""}
        placeholder="Search customer, design, colour"
        aria-label="Search"
        onChange={() => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => apply(true), 400);
        }}
        className={`${input} ${size}`}
      />
      <select name="type" defaultValue={type ?? ""} aria-label="Item" onChange={() => apply()} className={`${select} ${size}`}>
        <option value="">All items</option>
        {types.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select name="status" defaultValue={status ?? ""} aria-label="Production status" onChange={() => apply()} className={`${select} ${size}`}>
        {STATUS_FILTERS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <select name="due" defaultValue={due ?? ""} aria-label="Due date" onChange={() => apply()} className={`${select} ${size}`}>
        {DUE_FILTERS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button className={`${btnPrimary} flex-1 ${large ? "!min-h-14 text-lg" : ""}`}>Search</button>
        {active && (
          <Link href={action} className={`btn btn-quiet h-auto min-h-11 px-4 py-2 text-base ${large ? "!min-h-14 text-lg" : ""}`}>
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}
