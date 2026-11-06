import { itemStageViews } from "@/lib/stages";
import { itemShipReadiness } from "@/lib/shipping";
import { categoryDiffers } from "@/lib/item-sync";
import type { ItemSnapshot } from "@/db/schema";
import { completeStageAdminAction, refreshItemAction } from "@/app/admin/actions";
import { Icon } from "./Icon";
import { DownloadLink } from "@/components/DownloadLink";
import { btnSecondary } from "./ui";

const STATUS: Record<string, string> = { done: "Done ✓", open: "In progress", locked: "Locked" };

/** Under an order's form: the steps of each item, shipping state, and "update from the item". Pictures live in the form itself. */
export function AdminItemExtras({
  orderId,
  item,
}: {
  orderId: number;
  item: { id: number; label: string; snapshot: ItemSnapshot; templateId: number | null; values: Record<string, string> };
}) {
  const stages = itemStageViews(item.id);
  const shipping = itemShipReadiness(item.id);
  const changed = categoryDiffers(item);
  if (stages.length === 0 && !changed) return null;

  return (
    <section className="panel" style={{ borderColor: item.snapshot.colour }}>
      <details open className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden" title="Tap to minimize or open">
          <span className="inline-block h-5 w-5 shrink-0 rounded-full" style={{ background: item.snapshot.colour }} />
          <h2 className="text-xl font-medium">{item.label} - steps</h2>
          <Icon name="chevron" className="ml-auto h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 space-y-3">
      {changed && (
        <form action={refreshItemAction} className="space-y-2 rounded-2xl bg-accent-soft p-4">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="itemId" value={item.id} />
          <p className="text-base font-medium">The item has changed since this customer was added.</p>
          <p className="text-base">
            Update this customer to the item&apos;s current form and steps. What is already filled in stays, steps already done stay done, and the master is told it was updated.
          </p>
          <button className={btnSecondary}>Update from the item</button>
        </form>
      )}
      {stages.length > 0 && (
        <p className="text-base text-muted">
          {shipping.ready ? "Shipping: approved, the master can send it." : `Shipping: waiting. ${shipping.blockers.join("; ")}`}
        </p>
      )}

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
                <div className="space-y-2">
                  <form action={completeStageAdminAction}>
                    <input type="hidden" name="orderId" value={orderId} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="stageKey" value={s.key} />
                    <button className={btnSecondary} disabled={!s.photoOk || !s.fieldsOk}>
                      Mark done
                    </button>
                  </form>
                  {(!s.photoOk || !s.fieldsOk) && (
                    <details className="text-base">
                      <summary className="inline-flex min-h-11 cursor-pointer items-center underline">Cannot finish it?</summary>
                      <form action={completeStageAdminAction} className="mt-1 space-y-2">
                        <p>This finishes the step without the photo or fields check and opens the next step.</p>
                        <input type="hidden" name="orderId" value={orderId} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="stageKey" value={s.key} />
                        <input type="hidden" name="force" value="1" />
                        <button className={btnSecondary}>Mark done anyway</button>
                      </form>
                    </details>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
        </div>
      </details>
    </section>
  );
}
