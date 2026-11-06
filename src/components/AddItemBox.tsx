import { Icon } from "./Icon";
import { btnPrimary, select } from "./ui";

/** The id of the empty form this box belongs to. Its controls sit inside the customer form on the page, but send to this form. */
export const ADD_ITEM_FORM = "add-item-form";

/**
 * "Add another item for this customer", shown right under the masters. The select and button carry
 * form="add-item-form", so they submit the separate add-item form (a form cannot sit inside another form).
 */
export function AddItemBox({ orderId, options }: { orderId: number; options: { templateId: number; label: string }[] }) {
  if (options.length === 0) return null;
  return (
    <div className="space-y-3 rounded-3xl border border-accent/20 bg-accent-soft/60 p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
          <Icon name="plus" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-medium leading-tight">Add another item</p>
          <p className="text-base text-muted">Choose an item to add to this customer. Save your changes first.</p>
        </div>
      </div>
      <input type="hidden" name="orderId" value={orderId} form={ADD_ITEM_FORM} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <select name="templateId" form={ADD_ITEM_FORM} aria-label="Item to add" className={`${select} min-w-0 flex-1`}>
          {options.map((o) => (
            <option key={o.templateId} value={o.templateId}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="submit" form={ADD_ITEM_FORM} className={`${btnPrimary} sm:px-8`}>
          <Icon name="plus" className="h-4 w-4" /> Add item
        </button>
      </div>
    </div>
  );
}
