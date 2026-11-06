import Link from "next/link";
import { notFound } from "next/navigation";
import { FormBuilder } from "@/components/FormBuilder";
import { Notice, btnDanger, btnSecondary, input } from "@/components/ui";
import { getTemplate } from "@/lib/templates";
import { deleteCategoryAction, saveCategoryAction, setPrintGroupAction, updateCategoryAction } from "../actions";
import { Icon } from "@/components/Icon";

export default async function CategoryBuilder({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; e?: string }>;
}) {
  const t = getTemplate(Number((await params).id));
  if (!t) notFound();
  const { saved, e } = await searchParams;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link href="/admin/templates" className="link inline-flex min-h-12 items-center gap-2 text-base font-medium">
          <Icon name="arrow" className="h-4 w-4 rotate-180" /> All items
        </Link>
        <h1 className="page-title normal-case">
          {t.main?.name} &gt; {t.sub.name}
        </h1>
      </div>

      {e === "duplicate" && (
        <Notice tone="error">Two fields have the same name, so nothing was saved. Give each field its own name, then save again.</Notice>
      )}
      {saved && (
        <p role="status" className="alert alert-success text-lg font-medium">
          Saved. New customers will use this form.
        </p>
      )}

      <form action={updateCategoryAction} className="panel flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={t.sub.id} />
        <input type="hidden" name="back" value={`/admin/templates/${t.id}`} />
        <input name="name" defaultValue={t.sub.name} required className={`${input} min-w-0 flex-1 basis-40`} aria-label="Item name" />
        <input type="color" name="colour" defaultValue={t.sub.colour} className="h-12 w-14 shrink-0 cursor-pointer rounded-full border border-muted bg-paper p-1" aria-label="Colour" />
        <button className={btnSecondary}>Rename</button>
      </form>

      <FormBuilder
        key={`${t.id}-${t.version}-${saved ?? ""}`}
        id={t.id}
        version={t.version}
        action={saveCategoryAction}
        initialFields={t.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
          masterCanEdit: !!f.masterCanEdit,
          unit: f.unit ?? "",
          options: (f.options ?? []).join("\n"),
        }))}
        initialSteps={t.stages.map((s) => ({ key: s.key, label: s.label, photo: s.photo, needs: s.requiresFields ?? [] }))}
      />

      <form action={setPrintGroupAction} className="panel space-y-3">
        <input type="hidden" name="id" value={t.id} />
        <h2 className="text-xl font-medium">Printing</h2>
        <p className="text-base">
          Each item prints on its own page. To save paper, give two items the same name here and they share a page, for example
          &quot;Pagri and Shoes&quot;. Leave empty for a page of its own.
        </p>
        <input name="printGroup" defaultValue={t.printGroup ?? ""} placeholder="Shared page name (optional)" className={input} />
        <button className={btnSecondary}>Save</button>
      </form>

      <details className="collapse collapse-arrow border border-base-300 bg-base-100">
        <summary className="collapse-title text-base font-medium">Delete this item</summary>
        <form action={deleteCategoryAction} className="collapse-content space-y-3">
          <p>Existing customers are not changed.</p>
          <input type="hidden" name="id" value={t.sub.id} />
          <button className={btnDanger}>Yes, delete {t.sub.name}</button>
        </form>
      </details>
    </div>
  );
}
