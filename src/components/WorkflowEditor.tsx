"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { WorkflowFormState } from "@/app/admin/workflows/actions";
import { Icon } from "./Icon";
import { Notice, btnDanger, btnPrimary, btnSecondary, input, select } from "./ui";

type Step = { uid: string; key: string; label: string; photo: string };

/**
 * Make or change a workflow: a name and the steps in order, each with a rule for the work image the master sends
 * (none, optional, required). The steps are not fixed anywhere: add, remove and reorder as needed.
 */
export function WorkflowEditor({
  id,
  initialName,
  initialSteps,
  usedBy,
  action,
}: {
  id?: number;
  initialName: string;
  initialSteps: { key: string; label: string; photo: string }[];
  usedBy: { templateId: number; name: string }[];
  action: (prev: WorkflowFormState, f: FormData) => Promise<WorkflowFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [name, setName] = useState(initialName);
  const [steps, setSteps] = useState<Step[]>(() => initialSteps.map((s, i) => ({ ...s, uid: `s${i}` })));
  const [next, setNext] = useState(1000);

  const patch = (uid: string, p: Partial<Step>) => setSteps((rows) => rows.map((r) => (r.uid === uid ? { ...r, ...p } : r)));
  const move = (i: number, dir: -1 | 1) =>
    setSteps((rows) => {
      const j = i + dir;
      if (j < 0 || j >= rows.length) return rows;
      const copy = [...rows];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const stagesJson = JSON.stringify(steps.map(({ key, label, photo }) => ({ key, label, photo, needs: [] })));

  return (
    <form action={formAction} className="space-y-4">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <input type="hidden" name="stages" value={stagesJson} />

      {state.error && <Notice tone="error">{state.error}</Notice>}

      <label className="block">
        <span className="mb-1 block text-base font-medium">Workflow name</span>
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="For example: Shoes, or Bridal" className={input} />
      </label>

      <section aria-label="Steps" className="space-y-3">
        <h2 className="text-xl font-medium">Steps</h2>
        <p className="text-base text-muted">The steps in the order they happen. The work image is sent by the master from the phone.</p>
        {steps.map((s, i) => (
          <div key={s.uid} className="panel flex flex-wrap items-center gap-2 !p-3">
            <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-base font-medium text-accent-deep">
              {i + 1}
            </span>
            <input
              value={s.label}
              onChange={(e) => patch(s.uid, { label: e.target.value })}
              placeholder="Step name (for example Embroidery)"
              aria-label={`Step ${i + 1} name`}
              className={`${input} min-w-0 flex-1 basis-48`}
            />
            <select value={s.photo} onChange={(e) => patch(s.uid, { photo: e.target.value })} aria-label="Work image" className={`${select} basis-48 sm:w-56 sm:flex-none`}>
              <option value="none">No work image</option>
              <option value="optional">Work image: optional</option>
              <option value="upload">Work image: must add one</option>
              <option value="required">Work photo: you approve it</option>
            </select>
            <div className="flex gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={`${btnSecondary} !min-h-10 !px-3`} aria-label="Move step up">
                <Icon name="up" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} className={`${btnSecondary} !min-h-10 !px-3`} aria-label="Move step down">
                <Icon name="down" />
              </button>
              <button type="button" onClick={() => setSteps((rows) => rows.filter((r) => r.uid !== s.uid))} className={`${btnDanger} !min-h-10 !px-3`} aria-label="Remove step">
                <Icon name="trash" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            setSteps((rows) => [...rows, { uid: `t${next}`, key: "", label: "", photo: "optional" }]);
            setNext(next + 1);
          }}
          className={btnSecondary}
        >
          <Icon name="plus" /> Add a step
        </button>
      </section>

      {usedBy.length > 0 && (
        <p className="rounded-2xl bg-accent-soft px-4 py-3 text-base">
          Saving changes the steps of{" "}
          {usedBy.map((u, i) => (
            <span key={u.templateId}>
              {i > 0 && ", "}
              <Link href={`/admin/templates/${u.templateId}`} className="link font-medium">
                {u.name}
              </Link>
            </span>
          ))}{" "}
          for new customers. Customers already made keep their steps; open one and press &quot;Update from the item&quot; to bring it up to date.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button disabled={pending} className={btnPrimary}>
          {pending ? "Saving..." : "Save workflow"}
        </button>
        <Link href="/admin/workflows" className={btnSecondary}>
          Back
        </Link>
      </div>
    </form>
  );
}
