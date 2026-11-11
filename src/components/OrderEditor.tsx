"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { FieldDef } from "@/db/schema";
import { itemLabel } from "@/lib/items";
import { daysUntil } from "@/lib/colour";
import { emptyEditorState, type EditorItem, type EditorState } from "@/lib/editor-state";
import { FieldRow, isWideField } from "./FieldRow";
import { MasterPicker } from "./MasterPicker";
import { PictureStore } from "./PictureInput";
import { RemoveItemButton } from "./RemoveItemButton";
import { OrderPdfBox, type PdfRow } from "./OrderPdfBox";
import { FieldProgress } from "./FieldProgress";
import { Icon } from "./Icon";
import { Field, RequiredMark, btnPrimary, input, textarea, card } from "./ui";

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
  designNumber?: string | null;
  linkedDesignNumber?: string | null;
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
  designNumbers = [],
  pdfs = [],
}: {
  pdfs?: PdfRow[]; // PDFs already attached to this customer
  action: (prev: EditorState, f: FormData) => Promise<EditorState>;
  masters: Master[];
  base?: Base;
  items: EditorItem[];
  orderId?: number;
  submitLabel: string;
  picker?: CategoryPicker;
  designNumbers?: { designNumber: string; orderNumber: number; customerName: string }[]; // design numbers in use, offered when linking an accessory
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
  // an existing customer whose saved Karigar due date has passed: the date box turns red and says by how much
  const late = orderId && base.karigarDueDate ? -daysUntil(base.karigarDueDate) : 0;

  // after a save that found empty required fields: open the item, scroll to the first empty field and put the cursor in it
  useEffect(() => {
    const first = state.missingKeys[0];
    if (!first) return;
    const [itemKey, ...rest] = first.split(":");
    const el = document.getElementById(`f-${itemKey}-${rest.join(":")}`);
    if (!el) return;
    const card = el.closest("details");
    if (card) card.open = true;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.querySelector<HTMLElement>("input, textarea, select")?.focus({ preventScroll: true });
  }, [state.nonce, state.missingKeys]);

  // nobody chosen as master: say so at the Masters box before anything is sent
  const [noMaster, setNoMaster] = useState(false);

  return (
    <PictureStore.Provider value={pictures}>
    <form
      id={formId}
      action={formAction}
      key={state.nonce}
      className="space-y-3"
      onSubmit={(e) => {
        if (new FormData(e.currentTarget).getAll("masterIds").length === 0) {
          e.preventDefault();
          setNoMaster(true);
          document.getElementById("masters-field")?.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }}
    >
      {orderId ? <input type="hidden" name="orderId" value={orderId} /> : null}

      {state.error && <p role="alert" className="alert alert-error text-lg font-medium">{state.error}</p>}

      <div className="rounded-3xl border border-rule bg-paper-2 p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3 border-b border-rule pb-4">
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-deep">
            <Icon name="customers" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-medium leading-tight">{orderId ? "Customer details" : "Add customer details"}</h2>
            <p className="text-sm text-muted">
              Name, design number, masters and due dates. <RequiredMark /> means it must be filled in.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
          <Field label="Customer name" required upper>
            <input name="customerName" required defaultValue={pick("customerName", base.customerName)} className={input} />
          </Field>
          <Field label="Design number" required upper>
            <input
              name="designNumber"
              required
              defaultValue={pick("designNumber", base.designNumber ?? "")}
              className={`${input} uppercase`}
              autoCapitalize="characters"
              spellCheck={false}
            />
          </Field>
          <div id="masters-field" className="scroll-mt-24">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              Masters
              <RequiredMark />
            </span>
            <MasterPicker
              masters={masters}
              initial={
                "masterIds" in state.values
                  ? state.values.masterIds.split("\n").map(Number)
                  : (base.masterIds ?? (base.masterId ? [base.masterId] : []))
              }
              onChange={() => setNoMaster(false)}
            />
            {noMaster && (
              <p role="alert" className="mt-1 flex items-center gap-1.5 text-sm font-medium text-bad">
                <Icon name="alert" className="h-4 w-4 shrink-0" />
                Please choose a master
              </p>
            )}
          </div>
          <div>
            <Field label="Linked to design number" upper>
              <input
                name="linkedDesignNumber"
                list="design-numbers"
                defaultValue={pick("linkedDesignNumber", base.linkedDesignNumber ?? "")}
                className={`${input} uppercase`}
                autoCapitalize="characters"
                spellCheck={false}
              />
            </Field>
            <datalist id="design-numbers">
              {designNumbers.map((d) => (
                <option key={d.designNumber} value={d.designNumber}>
                  #{d.orderNumber} {d.customerName}
                </option>
              ))}
            </datalist>
            <p className="mt-1 text-sm text-muted">For an accessory: the design number of its main Sherwani or Bridal.</p>
          </div>
          <Field label="My due date (only you see this)" required upper>
            <input type="date" name="myDueDate" required defaultValue={pick("myDueDate", base.myDueDate)} className={input} />
          </Field>
          <div>
            <Field label="Karigar due date (master sees this)" required upper>
              <input
                type="date"
                name="karigarDueDate"
                required
                defaultValue={pick("karigarDueDate", base.karigarDueDate)}
                className={`${input} ${late > 0 ? "!border-bad !bg-bad-soft" : ""}`}
              />
            </Field>
            {late > 0 && (
              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-bad">
                <Icon name="alert" className="h-4 w-4" />
                Overdue by {late} {late === 1 ? "day" : "days"}
              </p>
            )}
          </div>
        </div>
      </div>

      {afterMasters}

      <OrderPdfBox orderId={orderId} files={pdfs} />

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
        <section key={item.key} className={`${card} border-2 !p-4`} style={{ borderColor: item.colour }}>
          {/* with more than two items the cards start closed, so the page stays short; the line under each name says where it is */}
          {/* a saved customer: an item with everything filled in starts closed, one with something still empty starts open; a new customer keeps the old rule */}
          <details open={orderId && item.progress && item.progress.total > 0 ? item.progress.filled < item.progress.total : allItems.length <= 2} className="group">
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden" title="Tap to minimize or open">
              <div className="flex min-h-11 items-center gap-2">
                <span className="inline-block h-5 w-5 shrink-0 rounded-full" style={{ background: item.colour }} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-medium">{item.label}</h2>
                    {item.progress && item.progress.total > 0 && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${
                          item.progress.filled >= item.progress.total ? "bg-ok-soft text-ok" : "bg-[#FEF3C7] text-[#92400E]"
                        }`}
                      >
                        {item.progress.filled}/{item.progress.total}
                      </span>
                    )}
                  </span>
                  {orderId && base.customerName && (
                    <span className="block text-base text-muted">
                      {base.customerName}
                      {base.designNumber ? ` - Design: ${base.designNumber}` : ""}
                    </span>
                  )}
                  {item.summary && <span className="block text-base text-muted">{item.summary}</span>}
                </span>
                {orderId && item.removable && <RemoveItemButton itemId={item.key} label={item.label} />}
                <Icon name="chevron" className={`${orderId && item.removable ? "" : "ml-auto "}h-5 w-5 shrink-0 transition-transform group-open:rotate-180`} />
              </div>
              {item.facts && item.facts.length > 0 && (
                <div className="-mx-4 mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-b-2xl group-open:hidden border-t border-rule bg-paper-3/60 px-4 py-2 text-sm text-ink-2">
                  {item.facts.map((f) => (
                    <span key={f.label}>
                      {f.label}: <b className="font-medium text-ink">{f.value}</b>
                    </span>
                  ))}
                </div>
              )}
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <input type="hidden" name="itemKey" value={item.key} />
              {item.templateId ? <input type="hidden" name={`t:${item.key}`} value={item.templateId} /> : null}
              <input type="hidden" name={`l:${item.key}`} value={item.label} />
              {orderId && item.photos && (
                <div className="sm:col-span-2">
                  <FieldProgress
                    fields={item.fields}
                    values={item.values}
                    pictureKeys={item.photos.map((p) => p.fieldKey)}
                  />
                </div>
              )}
              {orderId && item.extra && <div className="sm:col-span-2">{item.extra}</div>}
              {item.fields.length === 0 && <p className="sm:col-span-2">This item has no fields yet.</p>}
              {[...item.fields.filter((f) => f.type !== "picture"), ...item.fields.filter((f) => f.type === "picture")].map((f, n, all) => {
                const name = `v:${item.key}:${f.key}`;
                const firstPicture = f.type === "picture" && all.findIndex((x) => x.type === "picture") === n;
                // pictures pasted into any text box of this item land in its first picture area, at the end
                const pasteFrom = firstPicture ? item.fields.filter((x) => (x.type === "text" || x.type === "longtext") && !x.pictures).map((x) => `v:${item.key}:${x.key}`) : [];
                // pictures older forms attached to a text box are shown with that first picture area too
                const textKeys = new Set(item.fields.filter((x) => x.type === "longtext" && !x.pictures).map((x) => x.key));
                const photos = (item.photos ?? []).filter((p) => p.fieldKey === f.key || (firstPicture && textKeys.has(p.fieldKey)));
                return (
                  <div key={f.key} id={`f-${item.key}-${f.key}`} className={`scroll-mt-24 ${isWideField(f) ? "sm:col-span-2" : ""}`}>
                    <FieldRow
                      f={f}
                      name={name}
                      value={pick(name, item.values[f.key])}
                      pasteFrom={pasteFrom}
                      compact
                      missing={state.missingKeys.includes(`${item.key}:${f.key}`)}
                      saved={orderId && item.photos ? { itemId: Number(item.key), photos } : undefined}
                    />
                  </div>
                );
              })}
            </div>
          </details>
        </section>
      ))}

      {!formId && (
        <Field label="Extra notes for this customer">
          <textarea name="details" rows={3} defaultValue={pick("details", base.details)} className={textarea} />
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
          <p className="text-base">Fill these in, then save. Nothing is saved until every field is filled.</p>
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
