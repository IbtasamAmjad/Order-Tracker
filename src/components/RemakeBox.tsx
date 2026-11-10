import { remakeItemsAction } from "@/app/admin/actions";
import { Icon } from "./Icon";
import { btnPrimary, textarea } from "./ui";

/**
 * "Remake items": the office sends one, several or all items of this customer back for work again (for example a
 * delivered item that was wrong). The order keeps its original due date, so it shows as late.
 */
export function RemakeBox({ orderId, items }: { orderId: number; items: { id: number; label: string; sent: boolean; times: number }[] }) {
  if (items.length === 0) return null;
  return (
    <details className="group rounded-2xl border border-rule bg-paper-2 shadow-sm">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-5 py-3 text-base font-medium [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-deep">
          <Icon name="remake" className="h-5 w-5" />
        </span>
        <span className="flex-1">
          Remake items
          <span className="block text-sm font-normal text-muted">Send an item back to be made again</span>
        </span>
        <Icon name="chevron" className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <form action={remakeItemsAction} className="space-y-4 border-t border-rule px-5 py-4">
        <input type="hidden" name="orderId" value={orderId} />
        <p className="text-base text-muted">
          Choose the items that must be made again. Their steps start from the beginning, the due date stays the same (so they show as late), and the master is told why.
        </p>
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-rule-2 px-4 py-2 text-base hover:bg-paper-3">
                <input type="checkbox" name="item" value={i.id} className="checkbox checkbox-sm checkbox-primary" />
                <span className="flex-1 font-medium">{i.label}</span>
                {i.sent && <span className="rounded-full bg-cool-soft px-2.5 py-0.5 text-xs font-medium text-cloth">Sent</span>}
                {i.times > 0 && <span className="rounded-full bg-bad-soft px-2.5 py-0.5 text-xs font-medium text-bad">Remade {i.times}x</span>}
              </label>
            </li>
          ))}
        </ul>
        <label className="block">
          <span className="mb-1 block text-base font-medium">Why must it be remade?</span>
          <textarea name="reason" required rows={2} placeholder="For example: wrong size, wrong colour" className={textarea} />
        </label>
        <button className={btnPrimary}>Send back for remake</button>
      </form>
    </details>
  );
}
