import Link from "next/link";
import { ItemFilters } from "@/components/ItemFilters";
import { ItemResult } from "@/components/ItemResult";
import { EmptyState, PageHeader } from "@/components/ui";
import { itemRows, quantityByItem, searchItems, STATUS_TEXT } from "@/lib/item-search";

export const dynamic = "force-dynamic";

/**
 * Every ordered item across all customers: search it, pick one kind (Shoes, Shawls...) from the dropdown, filter by
 * production status ("not made yet"), and see how many of each kind were ordered.
 */
export default async function OrderedItems({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; status?: string; due?: string }> }) {
  const { q, type, status, due } = await searchParams;
  const all = itemRows();
  const found = searchItems(all, { q, type, status, due });
  const totals = quantityByItem(all);
  const types = totals.map((t) => t.itemName).sort((a, b) => a.localeCompare(b));
  const filtered = !!(q || type || status || due);
  const link = (t?: string) => (t ? `/admin/ordered-items?${new URLSearchParams({ ...(q ? { q } : {}), type: t, ...(status ? { status } : {}), ...(due ? { due } : {}) })}` : "/admin/ordered-items");

  return (
    <div className="space-y-5">
      <PageHeader icon="box" title="Ordered items" sub="Every item across all customers: due date, embroidery and status.">
        <Link href={`/admin/ordered-items/report?${new URLSearchParams({ ...(q ? { q } : {}), ...(type ? { type } : {}), ...(status ? { status } : {}), ...(due ? { due } : {}) })}`} className="btn btn-quiet inline-flex">
          Print report
        </Link>
      </PageHeader>

      <section aria-label="Total quantity of each item" className="space-y-2">
        <h2 className="text-lg font-medium">Total quantity</h2>
        {totals.length === 0 ? (
          <p className="text-base text-muted">Nothing ordered yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Link href={link()} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-base font-medium ${!type ? "border-ink bg-ink text-white" : "border-rule-2 bg-paper-2 hover:bg-paper-3"}`}>
              All items <span className={`rounded-full px-2 text-sm ${!type ? "bg-white/25" : "bg-paper-3"}`}>{all.length}</span>
            </Link>
            {totals.map((t) => (
              <Link
                key={t.itemName}
                href={link(t.itemName)}
                title={`${t.byStatus["not-started"] + t.byStatus["in-production"]} not made yet, ${t.byStatus.ready} ready to ship, ${t.byStatus.shipped} shipped`}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-base font-medium ${type === t.itemName ? "border-ink bg-ink text-white" : "border-rule-2 bg-paper-2 hover:bg-paper-3"}`}
              >
                {t.itemName} <span className={`rounded-full px-2 text-sm ${type === t.itemName ? "bg-white/25" : "bg-paper-3"}`}>{t.total}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <ItemFilters action="/admin/ordered-items" types={types} q={q} type={type} status={status} due={due} />

      {found.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-muted">
          <b className="font-medium text-ink">
            {filtered ? `${found.length} of ${all.length} items` : `${all.length} items`}
            {type && ` of ${type}`}
          </b>
          {(["not-started", "in-production", "ready", "shipped"] as const)
            .map((st) => [st, found.filter((r) => r.status === st).length] as const)
            .filter(([, n]) => n > 0)
            .map(([st, n]) => (
              <span key={st} className="inline-flex items-center gap-1.5">
                <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${{ "not-started": "bg-muted", "in-production": "bg-amber-500", ready: "bg-ok", shipped: "bg-cloth" }[st]}`} />
                {n} {STATUS_TEXT[st].toLowerCase()}
              </span>
            ))}
        </p>
      )}

      {found.length === 0 ? (
        <EmptyState title={filtered ? "No items match" : "No items yet"}>{filtered ? "Try another word, or press Clear." : "Items appear here as customers are added."}</EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {found.map((r) => (
            <ItemResult key={r.itemId} row={r} href={`/admin/orders/${r.orderId}`} photoUrl={(id) => `/api/admin/photos/${id}?thumb=1`} showMasters />
          ))}
        </ul>
      )}
    </div>
  );
}
