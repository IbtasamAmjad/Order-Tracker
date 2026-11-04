"use client";

import { useActionState } from "react";
import { emptyEditorState, type EditorItem, type EditorState } from "@/lib/editor-state";
import { FieldRow } from "./FieldRow";
import { Field, btnPrimary, btnSecondary, input, select, textarea, card } from "./ui";

type Master = { id: number; name: string };
type Base = {
  customerName?: string;
  myDueDate?: string;
  karigarDueDate?: string;
  masterId?: number;
  details?: string;
};

export function OrderEditor({
  action,
  masters,
  base = {},
  items,
  orderId,
  submitLabel,
}: {
  action: (prev: EditorState, f: FormData) => Promise<EditorState>;
  masters: Master[];
  base?: Base;
  items: EditorItem[];
  orderId?: number;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, emptyEditorState);
  // After a warning, show what the user typed instead of the saved values.
  const pick = (name: string, initial: string | undefined) => state.values[name] ?? initial ?? "";

  return (
    <form action={formAction} key={state.nonce} className="space-y-4">
      {orderId ? <input type="hidden" name="orderId" value={orderId} /> : null}

      {state.error && <p role="alert" className="alert alert-error text-lg font-medium">{state.error}</p>}

      <Field label="Customer name">
        <input name="customerName" required defaultValue={pick("customerName", base.customerName)} className={input} />
      </Field>
      <Field label="My due date (only you can see this)">
        <input type="date" name="myDueDate" required defaultValue={pick("myDueDate", base.myDueDate)} className={input} />
      </Field>
      <Field label="Karigar due date (master sees this)">
        <input
          type="date"
          name="karigarDueDate"
          required
          defaultValue={pick("karigarDueDate", base.karigarDueDate)}
          className={input}
        />
      </Field>
      <Field label="Master">
        <select
          name="masterId"
          required
          defaultValue={pick("masterId", base.masterId ? String(base.masterId) : "")}
          className={select}
        >
          <option value="" disabled>
            Choose a master
          </option>
          {masters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>

      {items.map((item) => (
        <section key={item.key} className={`${card} space-y-4 border-2`} style={{ borderColor: item.colour }}>
          <input type="hidden" name="itemKey" value={item.key} />
          {item.templateId ? <input type="hidden" name={`t:${item.key}`} value={item.templateId} /> : null}
          <input type="hidden" name={`l:${item.key}`} value={item.label} />
          <h2 className="flex items-center gap-2 text-xl font-medium">
            <span className="inline-block h-5 w-5 rounded-full" style={{ background: item.colour }} />
            {item.label}
          </h2>
          {item.fields.length === 0 && <p>This category has no fields yet.</p>}
          {item.fields.map((f) => {
            const name = `v:${item.key}:${f.key}`;
            return <FieldRow key={f.key} f={f} name={name} value={pick(name, item.values[f.key])} />;
          })}
        </section>
      ))}

      <Field label="Extra notes for this customer">
        <textarea name="details" rows={5} defaultValue={pick("details", base.details)} className={textarea} />
      </Field>

      {state.missing.length > 0 && (
        <div role="alert" className="alert alert-warning block space-y-3 border-2">
          <p className="text-lg font-medium">You haven&apos;t given:</p>
          <ul className="list-disc pl-6 text-lg">
            {state.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <div className="flex flex-col gap-2">
            <span className={`${btnSecondary} text-center`}>Fix them above, then save again</span>
            <button name="force" value="1" disabled={pending} className={btnPrimary}>
              Submit anyway
            </button>
          </div>
        </div>
      )}

      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
