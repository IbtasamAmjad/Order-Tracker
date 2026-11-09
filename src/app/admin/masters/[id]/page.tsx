import Link from "next/link";
import { notFound } from "next/navigation";
import { ItemFilters } from "@/components/ItemFilters";
import { ItemResult } from "@/components/ItemResult";
import { EmptyState, Ruler, PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { itemRows, searchItems, STATUS_TEXT } from "@/lib/item-search";
import { listMasters } from "@/lib/masters";

export const dynamic = "force-dynamic";

/** One master (karigar): all the items of his orders and how far they are. */
export default async function MasterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; type?: string; status?: string; due?: string }>;
}) {
  const id = Number((await params).id);
  const { q, type, status, due } = await searchParams;
  const master = listMasters().find((m) => m.id === id);
  if (!master) notFound();

  const all = itemRows(id);
  const found = searchItems(all, { q, type, status, due });
  const types = [...new Set(all.map((r) => r.itemName))].sort((a, b) => a.localeCompare(b));
  const counts = (["not-started", "in-production", "ready", "shipped"] as const).map((s) => ({ s, n: all.filter((r) => r.status === s).length }));
  const finished = all.filter((r) => r.status === "ready" || r.status === "shipped").length;
  const customers = new Set(all.map((r) => r.orderId)).size;

  return (
    <div className="space-y-5">
      <Link href="/admin/masters" className="link inline-flex min-h-11 items-center gap-2 text-base font-medium">
        <Icon name="arrow" className="h-4 w-4 rotate-180" /> Masters
      </Link>
      <PageHeader title={master.name} sub={`${customers} order${customers === 1 ? "" : "s"}, ${all.length} item${all.length === 1 ? "" : "s"}${master.active ? "" : " (inactive)"}`} />

      <section className="panel space-y-3" aria-label="Progress">
        <Ruler value={finished} total={all.length} label={`${finished} of ${all.length} items made`} />
        <div className="flex flex-wrap gap-2 text-base">
          {counts.map(({ s, n }) => (
            <Link
              key={s}
              href={`/admin/masters/${id}?status=${s}`}
              className="rounded-full border border-rule-2 bg-paper-3 px-3 py-1 hover:bg-paper-2"
            >
              {STATUS_TEXT[s]} <b className="font-medium">{n}</b>
            </Link>
          ))}
        </div>
      </section>

      <ItemFilters action={`/admin/masters/${id}`} types={types} q={q} type={type} status={status} due={due} />

      {found.length === 0 ? (
        <EmptyState title={q || type || status || due ? "No items match" : "No items yet"}>{q || type || status || due ? "Try another word, or press Clear." : "Items appear here when this master has orders."}</EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {found.map((r) => (
            <ItemResult key={r.itemId} row={r} href={`/admin/orders/${r.orderId}`} photoUrl={(pid) => `/api/admin/photos/${pid}?thumb=1`} />
          ))}
        </ul>
      )}
    </div>
  );
}
