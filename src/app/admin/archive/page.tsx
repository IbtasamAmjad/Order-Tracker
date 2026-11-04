import Link from "next/link";
import { listAdminOrders } from "@/lib/orders";
import { EmptyState, btnSecondary, fmtDate } from "@/components/ui";
import { setStatusAction } from "../actions";

export default function Archive() {
  const rows = listAdminOrders({ view: "closed" });
  return (
    <div className="space-y-4">
      <h1 className="page-title">Finished orders</h1>
      {rows.length === 0 && <EmptyState title="Nothing here yet">Completed and cancelled orders are kept here.</EmptyState>}
      <ul className="space-y-3">
        {rows.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 panel">
            <Link href={`/admin/orders/${o.id}`} className="block min-w-0 flex-1 basis-40">
              <div className="text-xl font-medium">
                #{o.orderNumber} {o.customerName}
              </div>
              <div>
                {o.status} {fmtDate(o.closedAt)}, {o.masterName}
              </div>
            </Link>
            {o.status !== "archived" && (
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
