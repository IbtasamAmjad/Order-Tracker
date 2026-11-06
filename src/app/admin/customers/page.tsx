import Link from "next/link";
import { listAdminOrders } from "@/lib/orders";
import { listMasters } from "@/lib/masters";
import { BAND_CLASS, BAND_LABEL } from "@/lib/colour";
import { EmptyState, PageHeader, PositionTile, btnPrimary, btnSecondary, card, fmtDate, fmtDay, input } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { moveOrderAction } from "../actions";

export default async function Customers({
  searchParams,
}: {
  searchParams: Promise<{ master?: string }>;
}) {
  const { master } = await searchParams;
  const masterId = Number(master) || undefined;
  const rows = listAdminOrders({ masterId, view: "active" });
  const masters = listMasters();
  const back = masterId ? `/admin/customers?master=${masterId}` : "/admin/customers";

  return (
    <div className="space-y-4">
      <PageHeader title="Customers" sub="In the order the masters should work them.">
        <Link href="/admin/orders/new" className={btnPrimary}>
          <Icon name="plus" className="h-4 w-4" /> New customer
        </Link>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        <form className="flex w-full flex-wrap gap-2">
          <select name="master" defaultValue={masterId ?? ""} className={`${input} min-w-0 flex-1 basis-40`}>
            <option value="">All masters</option>
            {masters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button className={btnSecondary}>Filter</button>
        </form>
      </div>

      {rows.length === 0 && <EmptyState title="No customers yet">Press New customer to start the order book.</EmptyState>}

      <ul className="space-y-4">
        {rows.map((o, i) => {
          const late = !!o.flags?.overdue;
          const status = late ? `Overdue by ${o.flags!.daysOverdue} day${o.flags!.daysOverdue === 1 ? "" : "s"}` : BAND_LABEL[o.band!].text;
          const pill = late || o.band === "red" ? "bg-thread" : o.band === "green" ? "bg-leaf" : "bg-cloth";
          return (
            <li key={o.id} className={`${card} space-y-3 border-l-4 ${late ? "border-l-thread" : BAND_CLASS[o.band!]}`}>
              <div className="flex items-start gap-3">
                <PositionTile n={i + 1} />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-xl font-medium leading-snug">
                    #{o.orderNumber} - {o.customerName}
                  </p>
                  <p className="text-base text-muted">{o.itemLabels.length > 0 ? o.itemLabels.join(", ") : "No items yet"}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-3 py-1 text-sm font-medium text-white ${pill}`}>{status}</span>
                  <div className="flex gap-1">
                    {(["up", "down"] as const).map((dir) => (
                      <form key={dir} action={moveOrderAction}>
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="dir" value={dir} />
                        <input type="hidden" name="back" value={back} />
                        <button className="btn btn-quiet !min-h-9 w-9 !px-0 text-xs" aria-label={`Move order ${o.orderNumber} ${dir}`}>
                          {dir === "up" ? "▲" : "▼"}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-base">
                <span className="rounded-full bg-accent-soft px-3 py-1 font-medium text-accent-deep">Master: {o.masterName}</span>
                <span className="rounded-full bg-paper-3 px-3 py-1">My due {fmtDay(o.myDueDate)}</span>
                <span className="rounded-full bg-paper-3 px-3 py-1 font-medium">Karigar due {fmtDay(o.karigarDueDate)}</span>
                {o.progress.total > 0 && (
                  <span className="rounded-full bg-paper-3 px-3 py-1">
                    Steps {o.progress.done} of {o.progress.total}
                  </span>
                )}
                {o.fields.total > 0 && (
                  <span className="rounded-full bg-paper-3 px-3 py-1">
                    Fields {o.fields.filled} of {o.fields.total}
                  </span>
                )}
              </div>

              <div className="space-y-0.5 text-base">
                {o.flags?.stale && <p className="font-medium text-thread">No update for {o.flags.idleDays} days</p>}
                {o.masterEditedAt && <p className="font-medium text-secondary">Master added info {fmtDate(o.masterEditedAt)}</p>}
                <p className="text-sm text-muted">{o.masterSeenAt ? `Master opened it ${fmtDate(o.masterSeenAt)}` : "Master has not opened it yet"}</p>
              </div>

              <Link href={`/admin/orders/${o.id}`} className={`${btnPrimary} w-full`}>
                Open customer
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
