import Link from "next/link";
import { DUE_FILTERS, STATUS_FILTERS } from "@/lib/item-search";
import { btnPrimary, input, select } from "./ui";

/** Search box, item dropdown and status dropdown for the item search. A plain form: it reloads the list with the choices. */
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
  large?: boolean; // the master's bigger controls
}) {
  const size = large ? "!min-h-14 text-lg" : "";
  const active = !!(q || type || status || due);
  return (
    <form action={action} method="get" className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]" role="search">
      <input name="q" defaultValue={q ?? ""} placeholder="Search customer, design, colour" aria-label="Search" className={`${input} ${size}`} />
      <select name="type" defaultValue={type ?? ""} aria-label="Item" className={`${select} ${size}`}>
        <option value="">All items</option>
        {types.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select name="status" defaultValue={status ?? ""} aria-label="Production status" className={`${select} ${size}`}>
        {STATUS_FILTERS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <select name="due" defaultValue={due ?? ""} aria-label="Due date" className={`${select} ${size}`}>
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
