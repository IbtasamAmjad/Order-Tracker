"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { FieldDef } from "@/db/schema";
import { itemLabel } from "@/lib/items";
import { emptyEditorState, type EditorItem, type EditorState } from "@/lib/editor-state";
import { FieldRow } from "./FieldRow";
import { MasterPicker } from "./MasterPicker";
import { PictureStore } from "./PictureInput";
import { RemoveItemButton } from "./RemoveItemButton";
import { FieldProgress } from "./FieldProgress";
import { Icon } from "./Icon";
import { Field, btnPrimary, btnSecondary, input, textarea, card } from "./ui";

type Master = { id: number; name: string };

/** Categories the admin can add to a NEW customer: tick the ones the customer needs, and their fields open below. */
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
  masterIds?: number[]; // every master of the order
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
  formId,
  afterMasters,
}: {
  action: (prev: EditorState, f: FormData) => Promise<EditorState>;
  masters: Master[];
  base?: Base;
  items: EditorItem[];
  orderId?: number;
  submitLabel: string;
  picker?: CategoryPicker;
  afterMasters?: React.ReactNode; // shown right under the masters (the page puts "Add another item" here)
  formId?: string; // when set, the page puts the Save button itself (with form="<formId>") and this form shows none
}) {
  const [state, formAction, pending] = useActionState(action, emptyEditorState);
  // pictures chosen but not saved yet; kept here while the form is shown again after a warning
  const [pictures] = useState(() => new Map<string, File[]>());
  // After a warning, show what the user typed instead of the saved values.
  const pick = (name: string, initial: string | undefined) => state.values[name] ?? initial ?? "";

  // new customer: which categories are ticked. Each one opens its own section of fields below.
  // (A link that asks for more than one of a category still gets them; the tick box just switches it on or off.)
  const [counts, setCounts] = useState<Record<number, number>>(picker?.initial ?? {});
  const toggle = (id: number) => setCounts((c) => ({ ...c, [id]: c[id] ? 0 : 1 }));
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
    <PictureStore.Provider value={pictures}>
    <form id={formId} action={formAction} key={state.nonce} className="space-y-4">
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
      <div>
        <span className="mb-1 block text-lg font-medium">Masters (choose one or more)</span>
        <MasterPicker
          masters={masters}
          initial={
            "masterIds" in state.values
              ? state.values.masterIds.split("\n").map(Number)
              : (base.masterIds ?? (base.masterId ? [base.masterId] : []))
          }
        />
      </div>

      {afterMasters}

      {picker && (
        <section className="space-y-3">
          <h2 className="text-xl font-medium">What does this customer need?</h2>
          {picker.groups.length === 0 ? (
            <p className="text-lg">
              No items yet.{" "}
              <Link href="/admin/templates" className="link font-medium">
                Set them up
              </Link>
              , or save the customer without categories.
            </p>
          ) : (
            <>
              <p className="text-lg">Tick each item this customer needs. Its fields open below.</p>
              {picker.groups.map((g) => (
                <div key={g.id} className="space-y-2">
                  <h3 className="text-lg font-medium">{g.name}</h3>
                  <div className="flex flex-wrap gap-2">
                    {g.items.map((it) => {
                      const on = (counts[it.templateId] ?? 0) > 0;
                      return (
                        <label
                          key={it.templateId}
                          className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 py-1 text-base ${on ? "bg-accent-soft text-accent-deep" : "bg-paper-3 text-ink"}`}
                        >
                          <input
                            type="checkbox"
                            name={`q${it.templateId}`}
                            value="1"
                            checked={on}
                            onChange={() => toggle(it.templateId)}
                            className="checkbox checkbox-sm checkbox-primary"
                          />
                          {it.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </section>
      )}

      {allItems.map((item) => (
        <section key={item.key} className={`${card} border-2`} style={{ borderColor: item.colour }}>
          <details open className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden" title="Tap to minimize or open">
              <span className="inline-block h-5 w-5 shrink-0 rounded-full" style={{ background: item.colour }} />
              <h2 className="text-xl font-medium">{item.label}</h2>
              {orderId && item.removable && <RemoveItemButton itemId={item.key} label={item.label} />}
              <Icon name="chevron" className={`${orderId && item.removable ? "" : "ml-auto "}h-5 w-5 shrink-0 transition-transform group-open:rotate-180`} />
            </summary>
            <div className="mt-4 space-y-4">
              <input type="hidden" name="itemKey" value={item.key} />
              {item.templateId ? <input type="hidden" name={`t:${item.key}`} value={item.templateId} /> : null}
              <input type="hidden" name={`l:${item.key}`} value={item.label} />
              {orderId && item.photos && (
                <FieldProgress fields={item.fields} values={item.values} pictureKeys={item.photos.map((p) => p.fieldKey)} />
              )}
              {item.fields.length === 0 && <p>This item has no fields yet.</p>}
              {item.fields.map((f) => {
                const name = `v:${item.key}:${f.key}`;
                return (
                  <FieldRow
                    key={f.key}
                    f={f}
                    name={name}
                    value={pick(name, item.values[f.key])}
                    pictures
                    saved={orderId && item.photos ? { itemId: Number(item.key), photos: item.photos.filter((p) => p.fieldKey === f.key) } : undefined}
                  />
                );
              })}
            </div>
          </details>
        </section>
      ))}

      {!formId && (
        <Field label="Extra notes for this customer">
          <textarea name="details" rows={5} defaultValue={pick("details", base.details)} className={textarea} />
        </Field>
      )}

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

      {!formId && (
        <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
          {pending ? "Saving..." : submitLabel}
        </button>
      )}
    </form>
    </PictureStore.Provider>
  );
}
