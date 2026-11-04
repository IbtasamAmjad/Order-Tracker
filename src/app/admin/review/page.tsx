import { pendingPhotos } from "@/lib/stages";
import { EmptyState, btnDanger, btnPrimary, fmtDate, input } from "@/components/ui";
import { WhatsAppNotice } from "@/components/WhatsAppNotice";
import { DownloadLink } from "@/components/DownloadLink";
import { photoNotice } from "@/lib/notify";
import { reviewPhotoAction } from "../actions";

export default async function Review({ searchParams }: { searchParams: Promise<{ e?: string; told?: string }> }) {
  const { e, told } = await searchParams;
  const notice = told ? photoNotice(Number(told)) : null;
  const rows = pendingPhotos();
  return (
    <div className="space-y-4">
      <h1 className="page-title">Photos to check</h1>
      <WhatsAppNotice notice={notice} />
      {e === "comment-needed" && (
        <p className=" bg-thread/10 p-3 text-lg font-medium text-thread">Please write a comment to reject a photo.</p>
      )}
      {rows.length === 0 && <EmptyState title="Nothing waiting">New photos from masters will show here.</EmptyState>}
      <ul className="space-y-4">
        {rows.map((p) => (
          <li key={p.id} className="space-y-3 panel">
            <div className="text-xl font-medium">
              #{p.orderNumber} {p.customerName}
            </div>
            <div className="text-lg">
              {p.itemLabel}, {p.stageLabel}, {p.masterName}
              <br />
              <span className="text-base">{fmtDate(p.uploadedAt)}</span>
            </div>
            <a href={`/api/admin/photos/${p.id}`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/admin/photos/${p.id}`} alt="Uploaded photo" className="w-full border" />
            </a>
            <DownloadLink href={`/api/admin/photos/${p.id}`} />
            <form action={reviewPhotoAction} className="space-y-2">
              <input type="hidden" name="id" value={p.id} />
              <textarea name="comment" rows={2} placeholder="Comment (needed if you reject)" className={input} />
              <div className="flex gap-2">
                <button name="decision" value="approved" className={`${btnPrimary} flex-1`}>
                  Approve
                </button>
                <button name="decision" value="rejected" className={`${btnDanger} flex-1`}>
                  Reject
                </button>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
