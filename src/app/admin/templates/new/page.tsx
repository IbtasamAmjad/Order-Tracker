import Link from "next/link";
import { Field, btnPrimary, input, select } from "@/components/ui";
import { listCategoryTree } from "@/lib/templates";
import { createCategoryAction } from "../actions";
import { Icon } from "@/components/Icon";

export default async function NewCategory({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const groups = listCategoryTree();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <Link href="/admin/templates" className="link inline-flex min-h-12 items-center gap-2 text-base font-medium">
          <Icon name="arrow" className="h-4 w-4 rotate-180" /> All categories
        </Link>
        <h1 className="page-title">New category</h1>
        <p className="text-lg">Give it a name. Next you will build its form by dragging in the fields you need.</p>
      </div>

      {e === "missing" && (
        <p role="alert" className="alert alert-error text-lg font-medium">
          Please type a category name and choose or name a group.
        </p>
      )}

      <form action={createCategoryAction} className="panel space-y-5">
        <Field label="Category name" hint="For example: Kurta, Sherwani, Pagri, Shoes">
          <input name="name" required autoFocus className={input} />
        </Field>

        {groups.length > 0 && (
          <Field label="Which group is it in?" hint="For example: Men or Ladies">
            <select name="parentId" defaultValue={groups[0].id} className={select}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label={groups.length > 0 ? "Or make a new group" : "Name of the group"} hint={groups.length > 0 ? "Leave empty to use the group above" : "For example: Men or Ladies"}>
          <input name="newGroup" required={groups.length === 0} className={input} />
        </Field>

        <label className="flex items-center gap-3">
          <span className="text-lg font-medium">Colour</span>
          <input type="color" name="colour" defaultValue="#3b4fc4" className="h-12 w-14 shrink-0 cursor-pointer rounded-full border border-muted bg-paper p-1" aria-label="Colour" />
        </label>

        <button className={`${btnPrimary} w-full`}>Create and add fields</button>
      </form>
    </div>
  );
}
