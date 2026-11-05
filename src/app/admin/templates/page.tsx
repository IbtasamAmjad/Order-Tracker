import Link from "next/link";
import { listCategoryTree } from "@/lib/templates";
import { EmptyState, Field, PageHeader, btnDanger, btnPrimary, btnSecondary, input } from "@/components/ui";
import { createMainAction, createSubAction, deleteCategoryAction, updateCategoryAction } from "./actions";
import { Icon } from "@/components/Icon";

const colourInput = "h-12 w-14 shrink-0 cursor-pointer rounded-full border border-muted bg-paper p-1";

export default function Templates() {
  const tree = listCategoryTree();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        sub="A group holds categories. For example the group Men holds Kurta and Pagri. Open a category to build its form."
      />

      {tree.length === 0 && (
        <EmptyState title="No groups yet">Start by adding a group below, such as Men or Ladies. Then add its categories.</EmptyState>
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
              <p className="text-base text-muted">No categories in {main.name} yet. Add the first one below.</p>
            ) : (
              <ul className="space-y-2">
                {main.subs.map((sub) => (
                  <li key={sub.id}>
                    <Link
                      href={`/admin/templates/${sub.template.id}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 panel text-xl font-medium"
                    >
                      <span className="inline-block h-5 w-5 rounded-full" style={{ background: sub.colour }} />
                      <span className="min-w-0 flex-1 basis-24 break-words">{sub.name}</span>
                      <span className="flex items-center gap-2 text-base font-normal">
                        {sub.template.fields.length} fields
                        <Icon name="arrow" className="h-4 w-4" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <form action={createSubAction} className="space-y-2">
              <p className="text-base font-medium">Add a category to {main.name}</p>
              <div className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="parentId" value={main.id} />
                <input name="name" required placeholder="Name (e.g. Kurta)" aria-label={`New category in ${main.name}`} className={`${input} min-w-0 flex-1 basis-40`} />
                <input type="color" name="colour" defaultValue="#64748b" className={colourInput} aria-label="Colour" />
                <button className={btnPrimary}>Add category</button>
              </div>
              <p className="text-sm text-muted">Next you will build its form.</p>
            </form>

            <details>
              <summary className="inline-flex min-h-11 cursor-pointer items-center text-base underline">Delete this group</summary>
              <form action={deleteCategoryAction} className="mt-2 space-y-2">
                <p>This also deletes its categories and forms. Existing orders are not changed.</p>
                <input type="hidden" name="id" value={main.id} />
                <button className={btnDanger}>Yes, delete {main.name}</button>
              </form>
            </details>
          </li>
        ))}
      </ul>

      <form action={createMainAction} className="space-y-3 panel">
        <h2 className="text-xl font-medium">Add a group</h2>
        <Field label="Group name" hint="For example: Men, Ladies, Shoes">
          <input name="name" required className={input} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <input type="color" name="colour" defaultValue="#64748b" className={colourInput} aria-label="Colour" />
          <button className={btnPrimary}>Add group</button>
        </div>
      </form>
    </div>
  );
}
