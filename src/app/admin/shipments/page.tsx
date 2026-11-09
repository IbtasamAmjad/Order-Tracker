import Link from "next/link";
import { markShipmentsSeen, submittedShipmentsForAdmin } from "@/lib/shipping";
import { EmptyState, fmtDate } from "@/components/ui";
import { DownloadLink } from "@/components/DownloadLink";

export const dynamic = "force-dynamic";

type Row = ReturnType<typeof submittedShipmentsForAdmin>[number];

/** The items of a shipment, grouped by customer (one shipment can hold several customers, with one bill). */
function byCustomer(s: Row) {
  const groups = new Map<number, { orderId: number; orderNumber: number; customerName: string; designNumber: string | null; labels: string[] }>();
  for (const i of s.items) {
    const g = groups.get(i.orderId) ?? { orderId: i.orderId, orderNumber: i.orderNumber, customerName: i.customerName, designNumber: i.designNumber, labels: [] };
    g.labels.push(i.label);
    groups.set(i.orderId, g);
  }
  return [...groups.values()];
}

/**
 * The shipments, newest first. A master sends all his finished items in one shipment with one bill, so a card shows
 * the master, the date, the items grouped by customer, the bill and the photo of the packed items.
 */
export default function Shipments() {
  const rows = submittedShipmentsForAdmin(); // newest first
  // Shown once now; the "new" badge clears after this page has been opened.
  markShipmentsSeen(rows.filter((r) => r.isNew).map((r) => r.id));

  return (
    <div className="space-y-4">
      <h1 className="page-title">Shipments</h1>
      {rows.length === 0 && <EmptyState title="No shipments yet">When a master sends items, they appear here with the bill.</EmptyState>}
      <ul className="space-y-4">
        {rows.map((s) => {
          const groups = byCustomer(s);
          return (
            <li key={s.id} className={`panel space-y-4 ${s.isNew ? "!bg-accent-soft/50" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-medium">
                  {s.masterName}
                  <span className="ml-2 text-base font-normal text-muted">{fmtDate(s.submittedAt)}</span>
                </h2>
                <div className="flex items-center gap-2">
                  {s.isNew && <span className="rounded-full bg-bad-soft px-3 py-1 text-sm font-medium text-bad">New</span>}
                  <span className="rounded-full bg-paper-3 px-3 py-1 text-base">
                    {s.items.length} item{s.items.length === 1 ? "" : "s"}, {groups.length} customer{groups.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <ul className="divide-y divide-rule rounded-2xl border border-rule">
                {groups.map((g) => (
                  <li key={g.orderId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                    <Link href={`/admin/orders/${g.orderId}`} className="link text-lg font-medium">
                      #{g.orderNumber} {g.customerName}
                    </Link>
                    {g.designNumber && <span className="text-base text-muted">Design: {g.designNumber}</span>}
                    <span className="ml-auto flex flex-wrap gap-2">
                      {g.labels.map((l) => (
                        <span key={l} className="rounded-full border border-rule-2 bg-paper-3/60 px-3 py-0.5 text-base">
                          {l}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-3">
                {s.billPhotoId && (
                  <div className="space-y-1 text-center text-base">
                    <a href={`/api/admin/photos/${s.billPhotoId}`} target="_blank" rel="noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/admin/photos/${s.billPhotoId}?thumb=1`} alt="Bill" className="h-28 rounded-xl border" />
                      Bill
                    </a>
                    <DownloadLink href={`/api/admin/photos/${s.billPhotoId}`} label="Download bill" />
                  </div>
                )}
                {s.packagePhotoId && (
                  <div className="space-y-1 text-center text-base">
                    <a href={`/api/admin/photos/${s.packagePhotoId}`} target="_blank" rel="noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/admin/photos/${s.packagePhotoId}?thumb=1`} alt="Packed items" className="h-28 rounded-xl border" />
                      Packed items
                    </a>
                    <DownloadLink href={`/api/admin/photos/${s.packagePhotoId}`} label="Download photo" />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
