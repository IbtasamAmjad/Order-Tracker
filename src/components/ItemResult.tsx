import Link from "next/link";
import type { ItemRow } from "@/lib/item-search";
import { STATUS_TEXT } from "@/lib/item-search";
import { daysUntil } from "@/lib/colour";
import { fmtDay } from "./ui";

const PILL = {
  "not-started": "border-rule-2 bg-paper-3 text-ink-2",
  "in-production": "border-accent/30 bg-accent-soft text-accent-deep",
  ready: "border-ok/30 bg-ok-soft text-ok",
  shipped: "border-cloth/30 bg-cool-soft text-cloth",
} as const;

const DOT = { "not-started": "bg-muted", "in-production": "bg-amber-500", ready: "bg-ok", shipped: "bg-cloth" } as const;

const MAX_PICTURES = 5;

/**
 * One ordered item for the item search: the customer, the order and its design number, the item, its colour, the
 * embroidery details, the reference pictures and where it is in production. Tap the card to open the order.
 */
export function ItemResult({
  row,
  href,
  photoUrl,
  showMasters = false,
}: {
  row: ItemRow;
  href: string;
  photoUrl: (id: number) => string;
  showMasters?: boolean;
}) {
  const late = row.status === "ready" || row.status === "shipped" ? 0 : Math.max(0, -daysUntil(row.karigarDueDate));
  const shown = row.photoIds.slice(0, MAX_PICTURES);
  const more = row.photoIds.length - shown.length;
  return (
    <li className="panel relative space-y-3 transition-shadow hover:shadow-[0_8px_24px_-10px_rgb(27_26_75/0.45)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* the link stretches over the whole card, the pictures sit above it */}
          <Link href={href} className="group after:absolute after:inset-0 after:content-['']" aria-label={`Open order ${row.orderNumber}, ${row.customerName}, ${row.label}`}>
            <p className="break-words text-xl font-medium leading-snug group-hover:underline">{row.customerName}</p>
          </Link>
          <p className="flex items-center gap-2 text-base text-muted">
            <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[row.status]}`} />
            <span className="font-medium text-ink">{row.label}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-sm font-medium ${PILL[row.status]}`}>{STATUS_TEXT[row.status]}</span>
          {row.stage && <span className="text-sm text-muted">{row.stage}</span>}
        </div>
      </div>

      <dl className="grid gap-x-4 gap-y-2 text-base sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">Order</dt>
          <dd className="font-medium">Order #{row.orderNumber}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Design number</dt>
          <dd className="font-medium">{row.designNumber ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Colour</dt>
          <dd className="flex items-center gap-2 font-medium">
            {row.colourHex && <span aria-hidden className="inline-block h-4 w-4 shrink-0 rounded-full border border-rule-2" style={{ background: row.colourHex }} />}
            {row.colourText || row.colourHex || "-"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Karigar due</dt>
          <dd className="font-medium">{fmtDay(row.karigarDueDate)}</dd>
          {late > 0 && <dd className="text-sm font-medium text-thread">Overdue by {late} day{late === 1 ? "" : "s"}</dd>}
        </div>
        {showMasters && (
          <div>
            <dt className="text-sm text-muted">Master</dt>
            <dd className="font-medium">{row.masterNames.join(", ") || "-"}</dd>
          </div>
        )}
        <div className={showMasters ? "" : "sm:col-span-2"}>
          <dt className="text-sm text-muted">Embroidery details</dt>
          <dd className="whitespace-pre-wrap break-words">{row.embroidery || "-"}</dd>
        </div>
      </dl>

      {shown.length > 0 && (
        <div className="relative z-10 flex flex-wrap items-center gap-2">
          {shown.map((id) => (
            <a key={id} href={photoUrl(id).replace("?thumb=1", "")} target="_blank" rel="noreferrer" className="block h-16 w-16 overflow-hidden rounded-xl border border-rule bg-paper-3" aria-label="Open this picture">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(id)} alt={`Reference picture for ${row.label}`} className="h-full w-full object-cover" />
            </a>
          ))}
          {more > 0 && <span className="text-sm text-muted">+{more} more</span>}
        </div>
      )}
    </li>
  );
}
