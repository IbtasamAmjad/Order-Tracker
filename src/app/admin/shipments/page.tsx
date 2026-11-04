import Link from "next/link";
import { markShipmentsSeen, submittedShipmentsForAdmin } from "@/lib/shipping";
import { EmptyState, fmtDate } from "@/components/ui";
import { DownloadLink } from "@/components/DownloadLink";

export default function Shipments() {
  const rows = submittedShipmentsForAdmin();
  // Shown once now; the "new" badge clears after this page has been opened.
  markShipmentsSeen(rows.filter((r) => r.isNew).map((r) => r.id));

  return (
    <div className="space-y-4">
      <h1 className="page-title">Shipments</h1>
      {rows.length === 0 && <EmptyState title="No shipments yet">When a master sends items, they appear here with the bill.</EmptyState>}
      <ul className="space-y-4">
        {rows.map((s) => (
          <li key={s.id} className={`space-y-2 panel ${s.isNew ? "bg-accent-soft" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/admin/orders/${s.orderId}`} className="link text-xl font-medium">
                #{s.orderNumber} {s.customerName}
              </Link>
              {s.isNew && <span className=" rounded-full bg-bad-soft px-3 py-1 text-sm font-medium text-bad">New</span>}
            </div>
            <div className="text-lg">
              {s.masterName}, {fmtDate(s.submittedAt)}
            </div>
            <div className="text-lg">
              <b>{s.items.length} item{s.items.length === 1 ? "" : "s"}:</b> {s.items.map((i) => i.label).join(", ")}
            </div>
            <div className="flex flex-wrap gap-3">
              {s.billPhotoId && (
                <div className="space-y-1 text-center text-base">
                  <a href={`/api/admin/photos/${s.billPhotoId}`} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/admin/photos/${s.billPhotoId}?thumb=1`} alt="Bill" className="h-28 border" />
                    Bill
                  </a>
                  <DownloadLink href={`/api/admin/photos/${s.billPhotoId}`} label="Download bill" />
                </div>
              )}
              {s.packagePhotoId && (
                <div className="space-y-1 text-center text-base">
                  <a href={`/api/admin/photos/${s.packagePhotoId}`} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/admin/photos/${s.packagePhotoId}?thumb=1`} alt="Packed items" className="h-28 border" />
                    Packed items
                  </a>
                  <DownloadLink href={`/api/admin/photos/${s.packagePhotoId}`} label="Download photo" />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
