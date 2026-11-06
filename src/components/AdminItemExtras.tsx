import { itemStageViews } from "@/lib/stages";
import { itemShipReadiness } from "@/lib/shipping";
import { categoryDiffers } from "@/lib/item-sync";
import type { ItemSnapshot } from "@/db/schema";
import { DownloadLink } from "@/components/DownloadLink";
import { btnSecondary } from "./ui";

const STATUS: Record<string, string> = { done: "Done ✓", open: "In progress", locked: "Locked" };

/** The forms the buttons below send to. The page renders them once, empty, because these buttons sit inside the customer form. */
export const STEP_FORM = "step-form";
export const REFRESH_FORM = "refresh-form";

/**
 * The steps of one item, its shipping state and "update from the item". It is shown inside the item's own card on
 * the customer page. Its buttons send to the page's step and refresh forms (form="...") so they work inside the
 * customer form without nesting forms.
 */
export function AdminItemExtras({
  item,
}: {
  item: { id: number; label: string; snapshot: ItemSnapshot; templateId: number | null; values: Record<string, string> };
}) {
  const stages = itemStageViews(item.id);
  const shipping = itemShipReadiness(item.id);
  const changed = categoryDiffers(item);
  if (stages.length === 0 && !changed) return null;

  return (
    <div className="space-y-3">
      {changed && (
        <div className="space-y-2 rounded-2xl bg-accent-soft p-4">
          <p className="text-base font-medium">The item has changed since this customer was added.</p>
          <p className="text-base">
            Update this customer to the item&apos;s current form and steps. What is already filled in stays, steps already done stay done, and the master is told it was updated.
          </p>
          <button type="submit" form={REFRESH_FORM} name="itemId" value={item.id} className={btnSecondary}>
            Update from the item
          </button>
        </div>
      )}

      {stages.length > 0 && (
        <div className="space-y-2">
          <p className="text-lg font-medium">Steps</p>
          <p className="text-base text-muted">
            {shipping.ready ? "Shipping: approved, the master can send it." : `Shipping: waiting. ${shipping.blockers.join("; ")}`}
          </p>
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
                    {s.latestPhoto && (s.photo !== "required" && s.latestPhoto.status === "pending" ? ", image added" : `, latest photo ${s.latestPhoto.status}`)}
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
                        <img src={`/api/admin/photos/${s.latestPhoto.id}?thumb=1`} alt={`Photo for ${s.label}`} className="h-16 w-16 rounded-xl border object-cover" />
                      </a>
                      <div className="space-y-1">
                        <p className="text-base">
                          {s.latestPhoto.status === "pending" && (s.photo === "required" ? "Waiting for your approval" : "Image sent by the master")}
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
                    <button
                      type="submit"
                      form={STEP_FORM}
                      name="step"
                      value={`${item.id}:${s.key}`}
                      className={btnSecondary}
                      disabled={!s.photoOk || !s.fieldsOk}
                    >
                      Mark done
                    </button>
                    {(!s.photoOk || !s.fieldsOk) && (
                      <details className="text-base">
                        <summary className="inline-flex min-h-11 cursor-pointer items-center underline">Cannot finish it?</summary>
                        <div className="mt-1 space-y-2">
                          <p>This finishes the step without the photo or fields check and opens the next step.</p>
                          <button type="submit" form={STEP_FORM} name="step" value={`${item.id}:${s.key}:force`} className={btnSecondary}>
                            Mark done anyway
                          </button>
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
