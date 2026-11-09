import Link from "next/link";
import { ItemFilters } from "@/components/ItemFilters";
import { Icon } from "@/components/Icon";
import { PrintButton } from "@/components/PrintButton";
import { btnSecondary, fmtDay } from "@/components/ui";
import { DUE_FILTERS, STATUS_FILTERS, itemRows, quantityByItem, searchItems, STATUS_TEXT } from "@/lib/item-search";

export const dynamic = "force-dynamic";

/**
 * A printable list of items: filter by item kind, customer or design number (the search box), due date and
 * production status, then Print (or "Save as PDF" in the print window). Shows colour, embroidery and design number.
 */
export default async function PendingReport({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; status?: string; due?: string }> }) {
  const { q, type, status, due } = await searchParams;
  const all = itemRows();
  // with no status chosen the report lists what is still to be made
  const effective = status ?? "not-made";
  const found = searchItems(all, { q, type, status: effective, due }).sort((a, b) => a.karigarDueDate.localeCompare(b.karigarDueDate) || a.orderNumber - b.orderNumber);
  const types = [...new Set(all.map((r) => r.itemName))].sort((a, b) => a.localeCompare(b));
  const totals = quantityByItem(found);
  const filterText = [
    type || "All items",
    STATUS_FILTERS.find((s) => s.value === effective)?.label,
    DUE_FILTERS.find((d) => d.value === (due ?? ""))?.label,
    q ? `Search: ${q}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 print:hidden">
        <Link href="/admin/ordered-items" className={`${btnSecondary} gap-2`}>
          <Icon name="arrow" className="h-4 w-4 rotate-180" /> Back
        </Link>
        <PrintButton />
        <span className="self-center text-base text-muted">In the print window you can also choose Save as PDF.</span>
      </div>
      <div className="print:hidden">
        <ItemFilters action="/admin/ordered-items/report" types={types} q={q} type={type} status={effective} due={due} />
      </div>

      <header>
        <h1 className="page-title">Items to make</h1>
        <p className="text-base text-muted">{filterText}</p>
        <p className="text-base">
          {found.length} item{found.length === 1 ? "" : "s"}
          {totals.length > 0 && `: ${totals.map((t) => `${t.total} ${t.itemName}`).join(", ")}`}
        </p>
      </header>

      {found.length === 0 ? (
        <p className="text-lg">No items match.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-base">
            <thead>
              <tr className="border-b-2 border-ink text-sm">
                {["Customer", "Design no.", "Item", "Colour", "Embroidery details", "Due", "Status"].map((h) => (
                  <th key={h} className="px-2 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {found.map((r) => (
                <tr key={r.itemId} className="break-inside-avoid border-b border-rule align-top">
                  <td className="px-2 py-2 font-medium">
                    {r.customerName}
                    <span className="block text-sm font-normal text-muted">Order #{r.orderNumber}</span>
                  </td>
                  <td className="px-2 py-2">{r.designNumber ?? "-"}</td>
                  <td className="px-2 py-2">{r.label}</td>
                  <td className="px-2 py-2">
                    {r.colourHex && <span aria-hidden className="mr-1 inline-block h-3 w-3 rounded-full border border-rule-2 align-middle" style={{ background: r.colourHex }} />}
                    {r.colourText || r.colourHex || "-"}
                  </td>
                  <td className="whitespace-pre-wrap break-words px-2 py-2">{r.embroidery || "-"}</td>
                  <td className="whitespace-nowrap px-2 py-2">{fmtDay(r.karigarDueDate)}</td>
                  <td className="px-2 py-2">
                    {STATUS_TEXT[r.status]}
                    {r.stage && <span className="block text-sm text-muted">{r.stage}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
