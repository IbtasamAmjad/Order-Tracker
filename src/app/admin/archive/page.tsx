import Link from "next/link";
import { closedCounts, listAdminOrders } from "@/lib/orders";
import { EmptyState, PageHeader, btnSecondary, fmtDate } from "@/components/ui";
import { setStatusAction, unarchiveOrderAction } from "../actions";

export default async function Archive({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const archived = view === "archived";
  const rows = listAdminOrders({ view: archived ? "archived" : "finished" });
  const counts = closedCounts();

  const tab = (on: boolean) =>
    `inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-base font-medium ${on ? "bg-accent-soft text-accent-deep" : "bg-paper-3 text-ink hover:bg-paper-2"}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title={archived ? "Archived orders" : "Finished orders"}
        sub={
          archived
            ? "Put away, out of the Finished list but kept. Unarchive one to bring it back."
            : "Completed and cancelled orders. Archive one to put it away."
        }
      />

      <nav aria-label="Finished and archived" className="flex flex-wrap gap-2">
        <Link href="/admin/archive" className={tab(!archived)} aria-current={!archived ? "page" : undefined}>
          Finished <span className="text-muted">{counts.finished}</span>
        </Link>
        <Link href="/admin/archive?view=archived" className={tab(archived)} aria-current={archived ? "page" : undefined}>
          Archived <span className="text-muted">{counts.archived}</span>
        </Link>
      </nav>

      {rows.length === 0 &&
        (archived ? (
          <EmptyState title="Nothing archived">Archive a finished order and it moves here, out of the way.</EmptyState>
        ) : (
          <EmptyState title="Nothing finished yet">Completed and cancelled orders appear here.</EmptyState>
        ))}

      <ul className="space-y-3">
        {rows.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 panel">
            <Link href={`/admin/orders/${o.id}`} className="block min-w-0 flex-1 basis-40">
              <div className="text-xl font-medium">
                #{o.orderNumber} {o.customerName}
              </div>
              <div>
                {archived ? (o.archivedFrom ?? "closed") : o.status} {fmtDate(o.closedAt)}, {o.masterName}
              </div>
            </Link>
            {archived ? (
              <form action={unarchiveOrderAction}>
                <input type="hidden" name="id" value={o.id} />
                <button className={btnSecondary}>Unarchive</button>
              </form>
            ) : (
              <form action={setStatusAction}>
                <input type="hidden" name="id" value={o.id} />
                <input type="hidden" name="status" value="archived" />
                <button className={btnSecondary}>Archive</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
