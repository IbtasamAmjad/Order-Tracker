import Link from "next/link";
import { fmtDay } from "./ui";
import { PhotoUpload } from "./PhotoUpload";
import { daysUntil } from "@/lib/colour";
import type { PendingStep } from "@/lib/item-search";

const SHOWN = 6;

/**
 * For a master: what is waiting for him, one line for each item (the step it is at, the customer and design number),
 * nearest due date first. When the step takes a photo, "Take photo" opens the camera straight away.
 */
export function PendingWork({ token, steps, all = false }: { token: string; steps: PendingStep[]; all?: boolean }) {
  if (steps.length === 0) return null;
  const late = steps.filter((s) => daysUntil(s.karigarDueDate) < 0).length;
  const soon = steps.filter((s) => {
    const d = daysUntil(s.karigarDueDate);
    return d >= 0 && d <= 7;
  }).length;
  return (
    <section className="space-y-3" aria-label="My pending work">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-medium">My pending work</h2>
        <Link href={`/m/${token}/items?due=7`} className="link text-base font-medium">
          {late > 0 ? `${late} late, ` : ""}
          {soon} due this week
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(all ? steps : steps.slice(0, SHOWN)).map((s) => {
          const left = daysUntil(s.karigarDueDate);
          return (
            <li key={s.itemId} className="panel space-y-2">
              <Link href={`/m/${token}/orders/${s.orderId}`} className="block">
                <p className="break-words text-xl font-medium leading-snug">
                  {s.label}: {s.stepLabel}
                </p>
                <p className="text-base text-muted">
                  {s.customerName}
                  {s.designNumber ? ` - Design: ${s.designNumber}` : ""}
                </p>
                <p className={`text-base font-medium ${left < 0 ? "text-thread" : ""}`}>
                  {left < 0 ? `Late by ${-left} day${left === -1 ? "" : "s"}` : `Due ${fmtDay(s.karigarDueDate)}`}
                </p>
              </Link>
              {!s.confirmed && <p className="text-base text-muted">Open the order and confirm it first.</p>}
              {s.confirmed && s.photoRule !== "none" && (
                <PhotoUpload endpoint={`/api/m/${token}/photos`} fields={{ itemId: String(s.itemId), stageKey: s.stepKey }} label="Take photo" camera />
              )}
            </li>
          );
        })}
      </ul>
      {!all && steps.length > SHOWN && (
        <Link href={`/m/${token}/items?status=not-made`} className="link inline-flex min-h-12 items-center text-lg font-medium">
          See all {steps.length} pending items
        </Link>
      )}
    </section>
  );
}
