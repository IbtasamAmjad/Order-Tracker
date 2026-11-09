import Link from "next/link";
import { notFound } from "next/navigation";
import { FormBuilder } from "@/components/FormBuilder";
import { Notice, btnDanger, btnSecondary, input } from "@/components/ui";
import { getTemplate } from "@/lib/templates";
import { deleteCategoryAction, saveCategoryAction, updateCategoryAction } from "../actions";
import { Icon } from "@/components/Icon";
import { listWorkflows } from "@/lib/workflows";
import { saveStepsAsWorkflowAction } from "../../workflows/actions";

export default async function CategoryBuilder({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; e?: string; wf?: string; wfError?: string }>;
}) {
  const t = getTemplate(Number((await params).id));
  if (!t) notFound();
  const { saved, e, wf, wfError } = await searchParams;

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
      {wf === "made" && <Notice tone="success">The workflow was made, and this item now uses it.</Notice>}
      {wfError && <Notice tone="error">{wfError}</Notice>}
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
        workflows={listWorkflows().map((w) => ({ id: w.id, name: w.name, steps: w.stages.map((s) => ({ key: s.key, label: s.label, photo: s.photo })) }))}
        initialWorkflowId={t.workflowId}
      />

      {t.workflowId === null && t.stages.length > 0 && (
        <form action={saveStepsAsWorkflowAction} className="panel space-y-3">
          <input type="hidden" name="templateId" value={t.id} />
          <h2 className="text-xl font-medium">Save these steps as a workflow</h2>
          <p className="text-base">
            Make a workflow from this item&apos;s saved steps ({t.stages.map((s) => s.label).join(", ")}), so other items can use it too. This item will use it.
          </p>
          <input name="name" required placeholder="Workflow name (for example Garment)" className={input} aria-label="Workflow name" />
          <button className={btnSecondary}>Save as a workflow</button>
        </form>
      )}

      <details className="group">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-thread/40 px-5 py-2 text-base font-medium text-thread transition-colors hover:bg-thread/10 group-open:bg-thread/10 [&::-webkit-details-marker]:hidden">
          <Icon name="trash" className="h-4 w-4" /> Delete this item
        </summary>
        <form action={deleteCategoryAction} className="mt-3 space-y-3 rounded-2xl border border-thread/30 bg-paper-2 p-4">
          <p className="text-base text-muted">Existing customers are not changed.</p>
          <input type="hidden" name="id" value={t.sub.id} />
          <button className={btnDanger}>Yes, delete {t.sub.name}</button>
        </form>
      </details>
    </div>
  );
}
