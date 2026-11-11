import { SortableCategories } from "@/components/SortableCategories";
import { listCategoryTree } from "@/lib/templates";
import { EmptyState, btnDanger, btnPrimary, btnSecondary, input } from "@/components/ui";
import { createMainAction, createSubAction, deleteCategoryAction, updateCategoryAction } from "./actions";
import { AddGroupBox } from "@/components/AddGroupBox";

const colourInput = "h-12 w-14 shrink-0 cursor-pointer rounded-full border border-muted bg-paper p-1";

export default function Templates() {
  const tree = listCategoryTree();
  return (
    <div className="space-y-6">
      <AddGroupBox
        title="Items"
        sub="A group holds items, for example Men holds Kurta and Pagri. Open an item to edit its form."
        action={createMainAction}
        startOpen={tree.length === 0}
      />

      {tree.length === 0 && (
        <EmptyState title="No groups yet">Press Add group to start, for example Men or Ladies.</EmptyState>
      )}

      <ul className="space-y-6">
        {tree.map((main) => (
          <li key={main.id} className="space-y-4 panel">
            <form action={updateCategoryAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={main.id} />
              <input name="name" defaultValue={main.name} required className={`${input} min-w-0 flex-1 basis-40`} aria-label="Group name" />
              <input type="color" name="colour" defaultValue={main.colour} className={colourInput} aria-label="Colour" />
              <button className={btnSecondary}>Save name</button>
            </form>

            {main.subs.length === 0 ? (
              <p className="text-base text-muted">No items in {main.name} yet. Add the first one below.</p>
            ) : (
              <SortableCategories
                key={main.subs.map((s) => s.id).join("-")}
                parentId={main.id}
                items={main.subs.map((s) => ({
                  id: s.id,
                  name: s.name,
                  colour: s.colour,
                  templateId: s.template.id,
                  fieldCount: s.template.fields.length,
                }))}
              />
            )}

            <form action={createSubAction} className="space-y-2">
              <p className="text-base font-medium">Add an item to {main.name}</p>
              <div className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="parentId" value={main.id} />
                <input name="name" required placeholder="Name (e.g. Kurta)" aria-label={`New item in ${main.name}`} className={`${input} min-w-0 flex-1 basis-40`} />
                <input type="color" name="colour" defaultValue="#64748b" className={colourInput} aria-label="Colour" />
                <button className={btnPrimary}>Add item</button>
              </div>
              <p className="text-sm text-muted">Next you will build its form.</p>
            </form>

            <details>
              <summary className="inline-flex min-h-11 cursor-pointer items-center text-base underline">Delete this group</summary>
              <form action={deleteCategoryAction} className="mt-2 space-y-2">
                <p>Also deletes its items and forms. Existing orders are not changed.</p>
                <input type="hidden" name="id" value={main.id} />
                <button className={btnDanger}>Yes, delete {main.name}</button>
              </form>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
