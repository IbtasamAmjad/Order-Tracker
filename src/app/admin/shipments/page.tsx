import Link from "next/link";
import { markShipmentsSeen, submittedShipmentsForAdmin } from "@/lib/shipping";
import { EmptyState, fmtDate } from "@/components/ui";
import { DownloadLink } from "@/components/DownloadLink";

export const dynamic = "force-dynamic";

type Row = ReturnType<typeof submittedShipmentsForAdmin>[number];

/**
 * The shipments, one card for each order. When an order was sent in several shipments (the master sent the items one
 * by one), they are sections of the same card, oldest first, each with its items, bill and packed-items photo.
 */
export default function Shipments() {
  const rows = submittedShipmentsForAdmin(); // newest first
  // Shown once now; the "new" badge clears after this page has been opened.
  markShipmentsSeen(rows.filter((r) => r.isNew).map((r) => r.id));

  const byOrder = new Map<number, Row[]>();
  for (const r of rows) byOrder.set(r.orderId, [...(byOrder.get(r.orderId) ?? []), r]); // the order with the newest shipment comes first
  const orders = [...byOrder.values()].map((list) => [...list].reverse()); // inside a card: oldest shipment first

  return (
    <div className="space-y-4">
      <h1 className="page-title">Shipments</h1>
      {orders.length === 0 && <EmptyState title="No shipments yet">When a master sends items, they appear here with the bill.</EmptyState>}
      <ul className="space-y-4">
        {orders.map((list) => {
          const first = list[0];
          const itemCount = list.reduce((n, s) => n + s.items.length, 0);
          const anyNew = list.some((s) => s.isNew);
          return (
            <li key={first.orderId} className={`panel space-y-4 ${anyNew ? "!bg-accent-soft/50" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/admin/orders/${first.orderId}`} className="link text-xl font-medium">
                  #{first.orderNumber} {first.customerName}
                </Link>
                <div className="flex items-center gap-2">
                  {anyNew && <span className="rounded-full bg-bad-soft px-3 py-1 text-sm font-medium text-bad">New</span>}
                  <span className="rounded-full bg-paper-3 px-3 py-1 text-base">
                    {list.length} shipment{list.length === 1 ? "" : "s"}, {itemCount} item{itemCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-rule rounded-2xl border border-rule">
                {list.map((s, n) => (
                  <section key={s.id} className={`space-y-3 p-4 ${s.isNew ? "bg-accent-soft/40" : ""}`} aria-label={`Shipment ${n + 1}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="flex items-center gap-2 text-lg font-medium">
                        <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-sm text-accent-deep">
                          {n + 1}
                        </span>
                        Shipment {n + 1}
                      </h2>
                      <span className="text-base text-muted">
                        {s.masterName}, {fmtDate(s.submittedAt)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-medium">
                        {s.items.length} item{s.items.length === 1 ? "" : "s"}:
                      </span>
                      {s.items.map((i) => (
                        <span key={i.itemId} className="rounded-full border border-rule-2 bg-paper-3/60 px-3 py-0.5 text-base">
                          {i.label}
                        </span>
                      ))}
                    </div>

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
                  </section>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
