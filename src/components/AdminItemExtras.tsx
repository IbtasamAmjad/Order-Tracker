import { itemStageViews, referencePhotos } from "@/lib/stages";
import { itemShipReadiness } from "@/lib/shipping";
import type { ItemSnapshot } from "@/db/schema";
import { completeStageAdminAction } from "@/app/admin/actions";
import { PhotoUpload } from "./PhotoUpload";
import { DownloadLink } from "@/components/DownloadLink";
import { btnSecondary } from "./ui";

const STATUS: Record<string, string> = { done: "Done ✓", open: "In progress", locked: "Locked" };

/** Under an order's form: reference pictures for picture fields, and the steps of each item. */
export function AdminItemExtras({
  orderId,
  item,
}: {
  orderId: number;
  item: { id: number; label: string; snapshot: ItemSnapshot };
}) {
  const pictureFields = item.snapshot.fields.filter((f) => f.type === "picture");
  const refs = referencePhotos(item.id);
  const stages = itemStageViews(item.id);
  const shipping = itemShipReadiness(item.id);
  if (pictureFields.length === 0 && stages.length === 0) return null;

  return (
    <section className="space-y-3 panel" style={{ borderColor: item.snapshot.colour }}>
      <h2 className="text-xl font-medium">{item.label}</h2>
      {stages.length > 0 && (
        <p className="text-base text-muted">
          {shipping.ready ? "Shipping: approved, the master can send it." : `Shipping: waiting. ${shipping.blockers.join("; ")}`}
        </p>
      )}

      {pictureFields.map((f) => (
        <div key={f.key} className="space-y-2">
          <p className="text-lg font-medium">{f.label}</p>
          <div className="flex flex-wrap gap-2">
            {refs
              .filter((r) => r.fieldKey === f.key)
              .map((r) => (
                <div key={r.id} className="space-y-1">
                  <a href={`/api/admin/photos/${r.id}`} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/admin/photos/${r.id}?thumb=1`} alt={f.label} className="h-24 w-24 border object-cover" />
                  </a>
                  <DownloadLink href={`/api/admin/photos/${r.id}`} label="Download" className="w-24 !px-2" />
                </div>
              ))}
          </div>
          <PhotoUpload endpoint="/api/admin/photos" fields={{ itemId: String(item.id), fieldKey: f.key }} label="Add picture" />
        </div>
      ))}

      {stages.length > 0 && (
        <ol className="space-y-2">
          {stages.map((s, n) => (
            <li key={s.key} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-paper-3 p-4">
              <div className="min-w-0 flex-1 basis-56">
                <div className="text-lg font-medium">
                  {n + 1}. {s.label}
                </div>
                <div className="text-base">
                  {STATUS[s.status]}
                  {s.photo !== "none" && `, photo ${s.photo}`}
                  {s.latestPhoto && `, latest photo ${s.latestPhoto.status}`}
                </div>
                {s.status === "open" && s.requiredFields.length > 0 && (
                  <div className="text-base">
                    {s.fieldsOk
                      ? "All required fields are filled in"
                      : `Still to fill in: ${s.requiredFields.filter((rf) => !rf.filled).map((rf) => rf.label).join(", ")}`}
                  </div>
                )}
                {s.latestPhoto && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <a href={`/api/admin/photos/${s.latestPhoto.id}`} target="_blank" rel="noreferrer" className="block shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/admin/photos/${s.latestPhoto.id}?thumb=1`} alt={`Photo for ${s.label}`} className="h-16 w-16 border object-cover" />
                    </a>
                    <div className="space-y-1">
                      <p className="text-base">
                        {s.latestPhoto.status === "pending" && "Waiting for your approval"}
                        {s.latestPhoto.status === "approved" && "Approved"}
                        {s.latestPhoto.status === "rejected" && `Rejected: ${s.latestPhoto.comment ?? "no comment"}`}
                      </p>
                      <DownloadLink href={`/api/admin/photos/${s.latestPhoto.id}`} />
                    </div>
                  </div>
                )}
              </div>
              {s.status === "open" && (
                <form action={completeStageAdminAction}>
                  <input type="hidden" name="orderId" value={orderId} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="stageKey" value={s.key} />
                  <button className={btnSecondary} disabled={!s.photoOk || !s.fieldsOk}>
                    Mark done
                  </button>
                </form>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
