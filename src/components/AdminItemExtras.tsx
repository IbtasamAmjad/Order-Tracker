import { itemStageViews } from "@/lib/stages";
import { itemShipReadiness } from "@/lib/shipping";
import { categoryDiffers } from "@/lib/item-sync";
import type { ItemSnapshot } from "@/db/schema";
import { DownloadLink } from "@/components/DownloadLink";
import { stageInstructions, stageNotes } from "@/lib/history";
import { StepNotesList } from "./HistoryList";
import { btnSecondary } from "./ui";

const STATUS: Record<string, string> = { done: "Done ✓", open: "In progress", locked: "Locked" };

/** The forms the buttons below send to. The page renders them once, empty, because these buttons sit inside the customer form. */
export const STEP_FORM = "step-form";
export const REFRESH_FORM = "refresh-form";
export const NOTE_FORM = "step-note-form";
export const INSTRUCTION_FORM = "instruction-form";

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
  const notes = stageNotes(item.id);
  const instructions = stageInstructions(item.id);
  const shipping = itemShipReadiness(item.id);
  const changed = categoryDiffers(item);
  if (stages.length === 0 && !changed) return null;

  return (
    <div className="space-y-3">
      {changed && (
        <div className="space-y-2 rounded-2xl bg-accent-soft p-4">
          <p className="text-base font-medium">The item has changed.</p>
          <p className="text-base">
            Bring this customer up to date. What is filled in and finished stays.
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
          {/* the steps side by side, one box each; a box that is opened (notes, "Cannot finish it?") takes the whole row */}
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-2">
            {stages.map((s, n) => (
              <li
                key={s.key}
                className={`flex min-w-0 flex-col gap-3 rounded-2xl border-t-4 bg-paper-3 p-3 has-[details[open]]:col-span-full ${
                  s.status === "done" ? "border-t-ok" : s.status === "open" ? "border-t-accent" : "border-t-rule-2"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2 text-lg font-medium leading-snug">
                    <span
                      aria-hidden
                      className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm ${
                        s.status === "done" ? "bg-ok text-white" : s.status === "open" ? "bg-accent text-accent-ink" : "bg-paper-2 text-muted shadow-[inset_0_0_0_1.5px_var(--color-muted)]"
                      }`}
                    >
                      {n + 1}
                    </span>
                    <span className="min-w-0 break-words">{s.label}</span>
                  </div>
                  <div className="mt-1 text-base">
                    {STATUS[s.status]}
                    {s.photo !== "none" && `, ${{ optional: "photo optional", upload: "photo must be added", required: "photo must be approved" }[s.photo]}`}
                    {s.photo === "required" ? s.latestPhoto && `, latest photo ${s.latestPhoto.status}` : s.status === "done" && s.allPhotos.length > 0 && ", image added"}
                  </div>
                  {s.days && s.status !== "done" && (
                    <div className={`text-base ${s.lateDays > 0 ? "font-medium text-bad" : "text-muted"}`}>
                      Should take {s.days} day{s.days === 1 ? "" : "s"}
                      {s.dueAt && ` (by ${s.dueAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })})`}
                      {s.lateDays > 0 && `. Late by ${s.lateDays} day${s.lateDays === 1 ? "" : "s"}`}
                    </div>
                  )}
                  {s.status === "open" && s.requiredFields.length > 0 && (
                    <div className="text-base">
                      {s.fieldsOk
                        ? "All required fields are filled in"
                        : `Still to fill in: ${s.requiredFields.filter((rf) => !rf.filled).map((rf) => rf.label).join(", ")}`}
                    </div>
                  )}
                  {/* the images of an optional step show to the office once the master has marked the step complete */}
                  {s.photo !== "required" && s.status === "done" && s.allPhotos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {s.allPhotos.map((p) => (
                        <a key={p.id} href={`/api/admin/photos/${p.id}`} target="_blank" rel="noreferrer" className="block" aria-label="Open this image">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/admin/photos/${p.id}?thumb=1`} alt={`Image for ${s.label}`} className="h-16 w-16 rounded-xl border object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  {s.photo === "required" && s.latestPhoto && (
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
                  <details className="mt-2 text-base">
                    <summary className="inline-flex min-h-10 cursor-pointer items-center gap-2 underline">
                      Instruction and notes
                      {(instructions.has(s.key) || (notes.get(s.key)?.length ?? 0) > 0) && (
                        <span className="rounded-full bg-accent-soft px-2 text-sm font-medium text-accent-deep no-underline">
                          {(instructions.has(s.key) ? 1 : 0) + (notes.get(s.key)?.length ?? 0)}
                        </span>
                      )}
                    </summary>
                    <div className="mt-2 space-y-3">
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium" htmlFor={`instr-${item.id}-${s.key}`}>
                          Instruction for this step (the master sees it)
                        </label>
                        <textarea id={`instr-${item.id}-${s.key}`} name={`instr:${item.id}:${s.key}`} form={INSTRUCTION_FORM} rows={2} maxLength={1000} defaultValue={instructions.get(s.key) ?? ""} className="textarea w-full text-base leading-snug" />
                        <button type="submit" form={INSTRUCTION_FORM} name="target" value={`${item.id}:${s.key}`} className={btnSecondary}>
                          Save instruction
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <StepNotesList notes={notes.get(s.key) ?? []} />
                        <textarea name={`note:${item.id}:${s.key}`} form={NOTE_FORM} rows={2} maxLength={1000} placeholder="Write a note about this step" aria-label={`Note for ${s.label}`} className="textarea w-full text-base leading-snug" />
                        <button type="submit" form={NOTE_FORM} name="target" value={`${item.id}:${s.key}`} className={btnSecondary}>
                          Add note
                        </button>
                      </div>
                    </div>
                  </details>
                </div>
                {s.status === "open" && (
                  <div className="space-y-1">
                    <button
                      type="submit"
                      form={STEP_FORM}
                      name="step"
                      value={`${item.id}:${s.key}`}
                      className={`${btnSecondary} w-full`}
                      disabled={!s.photoOk || !s.fieldsOk}
                    >
                      Mark done
                    </button>
                    {(!s.photoOk || !s.fieldsOk) && (
                      <details className="text-base">
                        <summary className="inline-flex min-h-11 cursor-pointer items-center underline">Cannot finish it?</summary>
                        <div className="mt-1 space-y-2">
                          <p>Finishes the step without the photo check and opens the next one.</p>
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
