import Link from "next/link";
import { listAdminOrders } from "@/lib/orders";
import { listMasters } from "@/lib/masters";
import { BAND_CLASS, BAND_LABEL } from "@/lib/colour";
import { EmptyState, PageHeader, PositionTile, btnPrimary, btnSecondary, card, fmtDate, input } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { WhatsAppNotice } from "@/components/WhatsAppNotice";
import { orderNotice, type OrderNoticeKind } from "@/lib/notify";
import { moveOrderAction } from "../actions";

export default async function Customers({
  searchParams,
}: {
  searchParams: Promise<{ master?: string; notify?: string }>;
}) {
  const { master, notify } = await searchParams;
  const [kind, nid] = (notify ?? "").split(":");
  const notice = kind && nid ? orderNotice(kind as OrderNoticeKind, Number(nid)) : null;
  const masterId = Number(master) || undefined;
  const rows = listAdminOrders({ masterId, view: "active" });
  const masters = listMasters();
  const back = masterId ? `/admin/customers?master=${masterId}` : "/admin/customers";

  return (
    <div className="space-y-4">
      <WhatsAppNotice notice={notice} />
      <PageHeader title="Customers" sub="In the order the masters should work them.">
        <Link href="/admin/orders/new" className={btnPrimary}>
          <Icon name="plus" className="h-4 w-4" /> New customer
        </Link>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        <form className="flex gap-2">
          <select name="master" defaultValue={masterId ?? ""} className={input + " min-w-48"}>
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

      <ul className="space-y-3">
        {rows.map((o, i) => (
          <li key={o.id} className={`${card} border-l-4 ${BAND_CLASS[o.band!]}`}>
            <div className="flex items-start gap-3">
              <PositionTile n={i + 1} />
              <Link href={`/admin/orders/${o.id}`} className="block min-w-0 flex-1">
                <div className="break-words text-lg font-medium">
                  #{o.orderNumber} {o.customerName}
                </div>
                <div className="text-base">Master: <b className="font-medium">{o.masterName}</b></div>
                <div className="text-base text-muted">
                  My due <span className="whitespace-nowrap">{o.myDueDate}</span>, Karigar due <span className="whitespace-nowrap">{o.karigarDueDate}</span>
                </div>
                <div className={`text-base font-medium ${o.flags?.overdue ? "text-thread" : BAND_LABEL[o.band!].className}`}>
                  {o.flags?.overdue ? `Overdue by ${o.flags.daysOverdue} day${o.flags.daysOverdue === 1 ? "" : "s"}` : BAND_LABEL[o.band!].text}
                </div>
                {o.flags?.stale && <div className="text-base font-medium text-thread">No update for {o.flags.idleDays} days</div>}
                {o.masterEditedAt && <div className="text-base font-medium text-secondary">Master added info {fmtDate(o.masterEditedAt)}</div>}
                <div className="text-sm">{o.masterSeenAt ? `Seen ${fmtDate(o.masterSeenAt)}` : "Master has not opened it"}</div>
              </Link>
              <div className="flex flex-col gap-1.5">
                {(["up", "down"] as const).map((dir) => (
                  <form key={dir} action={moveOrderAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="dir" value={dir} />
                    <input type="hidden" name="back" value={back} />
                    <button className="btn btn-quiet !min-h-11 w-11 !px-0 text-xs" aria-label={`Move order ${o.orderNumber} ${dir}`}>
                      {dir === "up" ? "▲" : "▼"}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
