import Link from "next/link";
import { Icon } from "@/components/Icon";
import { EmptyState, Notice, PageHeader, btnDanger, btnPrimary, btnSecondary } from "@/components/ui";
import { listWorkflows } from "@/lib/workflows";
import { deleteWorkflowAction } from "./actions";

export const dynamic = "force-dynamic";

const PHOTO = { none: "", optional: "image optional", upload: "image needed", required: "photo to approve" } as const;

/** The reusable workflows: the steps each kind of item goes through. An item type can use one, or have its own steps. */
export default async function Workflows({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string }> }) {
  const { saved, deleted } = await searchParams;
  const list = listWorkflows();
  return (
    <div className="space-y-5">
      <PageHeader title="Workflows" sub="The steps each kind of item goes through. Make one once, then use it for several items.">
        <Link href="/admin/workflows/new" className={btnPrimary}>
          <Icon name="plus" className="h-4 w-4" /> New workflow
        </Link>
      </PageHeader>

      {saved && <Notice tone="success">Saved.</Notice>}
      {deleted && <Notice tone="success">The workflow was deleted. The items that used it keep their steps.</Notice>}

      {list.length === 0 ? (
        <EmptyState title="No workflows yet">Press New workflow to make the first one.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {list.map((w) => (
            <li key={w.id} className="panel space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-medium">{w.name}</h2>
                <Link href={`/admin/workflows/${w.id}`} className={btnSecondary}>
                  Edit
                </Link>
              </div>

              <ol className="flex flex-wrap items-center gap-x-2 gap-y-2" aria-label="Steps">
                {w.stages.map((s, i) => (
                  <li key={s.key} className="flex items-center gap-2">
                    {i > 0 && <Icon name="arrow" className="h-4 w-4 text-muted" />}
                    <span className="rounded-full border border-rule-2 bg-paper-3/60 px-3 py-1 text-base font-medium">
                      {s.label}
                      {PHOTO[s.photo] && <span className="ml-2 text-sm font-normal text-muted">{PHOTO[s.photo]}</span>}
                    </span>
                  </li>
                ))}
              </ol>

              <p className="text-base text-muted">
                {w.usedBy.length === 0 ? (
                  "Not used by any item yet. Choose it in an item's steps."
                ) : (
                  <>
                    Used by{" "}
                    {w.usedBy.map((u, i) => (
                      <span key={u.templateId}>
                        {i > 0 && ", "}
                        <Link href={`/admin/templates/${u.templateId}`} className="link font-medium text-ink">
                          {u.name}
                        </Link>
                      </span>
                    ))}
                  </>
                )}
              </p>

              <details className="text-base">
                <summary className="inline-flex min-h-10 cursor-pointer items-center text-muted underline">Delete this workflow</summary>
                <form action={deleteWorkflowAction} className="mt-2 space-y-2">
                  <input type="hidden" name="id" value={w.id} />
                  <p>The items that use it keep their steps, as their own. Customers are not changed.</p>
                  <button className={btnDanger}>Delete {w.name}</button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
