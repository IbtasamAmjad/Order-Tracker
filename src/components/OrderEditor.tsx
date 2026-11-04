"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { FieldDef } from "@/db/schema";
import { itemLabel } from "@/lib/items";
import { emptyEditorState, type EditorItem, type EditorState } from "@/lib/editor-state";
import { FieldRow } from "./FieldRow";
import { Field, btnPrimary, btnSecondary, input, select, textarea, card } from "./ui";

type Master = { id: number; name: string };

/** Categories the admin can add to a NEW customer: pick how many of each, and their fields open below. */
export type CategoryPicker = {
  groups: { id: number; name: string; items: { templateId: number; name: string; colour: string }[] }[];
  templates: Record<number, { name: string; colour: string; fields: FieldDef[] }>;
  initial?: Record<number, number>;
};
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
  picker,
}: {
  action: (prev: EditorState, f: FormData) => Promise<EditorState>;
  masters: Master[];
  base?: Base;
  items: EditorItem[];
  orderId?: number;
  submitLabel: string;
  picker?: CategoryPicker;
}) {
  const [state, formAction, pending] = useActionState(action, emptyEditorState);
  // After a warning, show what the user typed instead of the saved values.
  const pick = (name: string, initial: string | undefined) => state.values[name] ?? initial ?? "";

  // new customer: how many of each category (0 to 10). Each one opens its own section of fields below.
  const [counts, setCounts] = useState<Record<number, number>>(picker?.initial ?? {});
  const setCount = (id: number, raw: string) => setCounts((c) => ({ ...c, [id]: Math.max(0, Math.min(10, Math.floor(Number(raw)) || 0)) }));
  const chosen: EditorItem[] = [];
  for (const g of picker?.groups ?? []) {
    for (const it of g.items) {
      const qty = counts[it.templateId] ?? 0;
      const tpl = picker?.templates[it.templateId];
      if (!tpl) continue;
      for (let i = 0; i < qty; i++) {
        // the key stays the same for the same category and position, so what was typed is kept when a number changes
        chosen.push({ key: `t${it.templateId}i${i}`, templateId: it.templateId, label: itemLabel(tpl.name, i, qty), colour: tpl.colour, fields: tpl.fields, values: {} });
      }
    }
  }
  const allItems = [...items, ...chosen];

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

      {picker && (
        <section className="space-y-3">
          <h2 className="text-xl font-medium">What does this customer need?</h2>
          {picker.groups.length === 0 ? (
            <p className="text-lg">
              No categories yet.{" "}
              <Link href="/admin/templates" className="link font-medium">
                Set them up
              </Link>
              , or save the customer without categories.
            </p>
          ) : (
            <>
              <p className="text-lg">Put a number next to each category this customer needs. Leave the others at 0. Its fields open below.</p>
              {picker.groups.map((g) => (
                <div key={g.id} className="space-y-2">
                  <h3 className="text-lg font-medium">{g.name}</h3>
                  {g.items.map((it) => (
                    <label key={it.templateId} className="panel flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="inline-block h-5 w-5 shrink-0 rounded-full" style={{ background: it.colour }} />
                      <span className="min-w-0 flex-1 basis-24 break-words text-xl">{it.name}</span>
                      <input
                        type="number"
                        name={`q${it.templateId}`}
                        min={0}
                        max={10}
                        value={counts[it.templateId] ?? 0}
                        onChange={(e) => setCount(it.templateId, e.target.value)}
                        inputMode="numeric"
                        className={`${input} !w-24 shrink-0 text-center`}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </>
          )}
        </section>
      )}

      {allItems.map((item) => (
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
