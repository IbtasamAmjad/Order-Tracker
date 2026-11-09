import Link from "next/link";
import { ItemFilters } from "@/components/ItemFilters";
import { ItemResult } from "@/components/ItemResult";
import { Icon } from "@/components/Icon";
import { PinForm } from "@/components/PinForm";
import { EmptyState } from "@/components/ui";
import { itemRows, searchItems } from "@/lib/item-search";
import { linkState, requireMaster } from "@/lib/master-session";

export const dynamic = "force-dynamic";

/**
 * For a master: the same kind of item from different customers' orders, grouped together (all the Shoes in one place,
 * all the Shawls in another). Only his own orders.
 */
export default async function MasterItems({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ q?: string; type?: string; status?: string; due?: string; e?: string }>;
}) {
  const { token } = await params;
  const { q, type, status, due, e } = await searchParams;

  const state = await linkState(token);
  if (state === "invalid") return <p className="text-xl">This link is not valid. Ask the office for a new link.</p>;
  if (state === "need-pin") return <PinForm token={token} error={e} />;

  const master = (await requireMaster(token))!;
  const all = itemRows(master.id);
  const found = searchItems(all, { q, type, status, due });
  const types = [...new Set(all.map((r) => r.itemName))].sort((a, b) => a.localeCompare(b));

  // the same kind of item together, each group with its quantity
  const groups = new Map<string, typeof found>();
  for (const r of found) groups.set(r.itemName, [...(groups.get(r.itemName) ?? []), r]);
  const ordered = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-5">
      <Link href={`/m/${token}`} className="link inline-flex min-h-12 items-center gap-2 text-lg font-medium">
        <Icon name="arrow" className="h-4 w-4 rotate-180" /> Back
      </Link>
      <header>
        <h1 className="page-title text-4xl">Items</h1>
        <p className="text-lg">The same items from different customers, together.</p>
      </header>

      <ItemFilters action={`/m/${token}/items`} types={types} q={q} type={type} status={status} due={due} large />

      {ordered.length === 0 ? (
        <EmptyState title={q || type || status || due ? "No items match" : "No items yet"}>{q || type || status || due ? "Try another word, or press Clear." : "Items from your orders appear here."}</EmptyState>
      ) : (
        ordered.map(([name, rows]) => (
          <section key={name} className="space-y-3">
            <h2 className="flex items-center gap-3 border-b border-rule pb-2 text-2xl font-medium">
              {name}
              <span className="rounded-full bg-accent-soft px-3 py-0.5 text-lg text-accent-deep">{rows.length}</span>
            </h2>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((r) => (
                <ItemResult key={r.itemId} row={r} href={`/m/${token}/orders/${r.orderId}`} photoUrl={(id) => `/api/m/${token}/photos/${id}?thumb=1`} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
