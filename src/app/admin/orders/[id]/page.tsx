import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderEditor } from "@/components/OrderEditor";
import { getOrder, linkedOrders, listDesignNumbers, listItems, orderOfDesign } from "@/lib/orders";
import { assignedMasterIds } from "@/lib/assign";
import { referencePhotos } from "@/lib/stages";
import { orderShipments, shippableItems } from "@/lib/shipping";
import { listMasters } from "@/lib/masters";
import { pickerGroups } from "@/lib/templates";
import type { EditorItem } from "@/lib/editor-state";
import { listOrderFiles } from "@/lib/order-files";
import { displayValue, fieldProgress, isDisplayOnly, missingFields } from "@/lib/items";
import { itemTrack } from "@/lib/track";
import type { FieldDef } from "@/db/schema";
import { AdminItemExtras, INSTRUCTION_FORM, NOTE_FORM, REFRESH_FORM, STEP_FORM } from "@/components/AdminItemExtras";
import { HistoryList } from "@/components/HistoryList";
import { orderHistory } from "@/lib/history";
import { remakeCount } from "@/lib/remake";
import { syncActiveItems } from "@/lib/item-sync";
import { RemakeBox } from "@/components/RemakeBox";
import { ADD_ITEM_FORM, AddItemBox } from "@/components/AddItemBox";
import { Icon } from "@/components/Icon";
import { Notice, btnDanger, btnPrimary, btnSecondary, fmtDate, Field, textarea } from "@/components/ui";
import { addItemAction, instructionAction, refreshItemAction, removeItemAction, saveOrderAction, setStatusAction, stepAdminAction, stepNoteAction } from "../../actions";

const REFRESH_ERRORS: Record<string, string> = {
  "remove-shipped": "That item was already sent, so it cannot be removed.",
  "remove-order-closed": "This customer is closed, so items cannot be removed.",
  "remove-not-found": "That item was not found.",
  "refresh-no-category": "This customer's item was deleted, so it cannot be updated from it.",
  "refresh-closed": "A finished or cancelled customer cannot be updated.",
  "refresh-not-found": "That item was not found.",
  "remake-no-reason": "Write why it must be remade, then send it back again.",
  "remake-no-items": "Tick at least one item to remake.",
  "remake-cancelled": "A cancelled customer cannot be remade.",
  "remake-not-found": "That customer was not found.",
};

/** "3 of 11 fields filled. Now: Stitching" for the closed card of an item. */
function itemSummary(i: { id: number; snapshot: { fields: FieldDef[] }; values: Record<string, string> }): string {
  const p = fieldProgress(i.snapshot.fields, i.values, referencePhotos(i.id).map((r) => r.fieldKey ?? ""));
  const now = itemTrack(i.id).find((s) => s.state === "current");
  const required = missingFields(i.snapshot.fields, i.values).length;
  const remade = remakeCount(i.id);
  return `${p.filled} of ${p.total} fields filled${required > 0 ? `. ${required} still empty` : ""}${now ? `. Now: ${now.label}` : ". All done"}${remade > 0 ? `. Remade ${remade} time${remade === 1 ? "" : "s"}` : ""}`;
}

/** Fields filled out of all fields, for the little chip on an item's card. */
function itemProgress(i: { id: number; snapshot: { fields: FieldDef[] }; values: Record<string, string> }) {
  return fieldProgress(i.snapshot.fields, i.values, referencePhotos(i.id).map((r) => r.fieldKey ?? ""));
}

/** A few key answers for the strip on an item's card: the measurements (numbers, or anything under a Measurements heading). */
function itemFacts(i: { snapshot: { fields: FieldDef[] }; values: Record<string, string> }): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  let measure = false;
  for (const f of i.snapshot.fields) {
    if (f.type === "heading") {
      measure = /measure/i.test(f.label);
      continue;
    }
    if (isDisplayOnly(f) || ["picture", "longtext", "color"].includes(f.type)) continue;
    const v = (i.values[f.key] ?? "").trim();
    if (v && (measure || f.type === "number")) out.push({ label: f.label, value: v });
  }
  return out.slice(0, 6);
}

export default async function EditOrder({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string; removed?: string; e?: string }>;
}) {
  const { updated, removed, e } = await searchParams;
  const order = getOrder(Number((await params).id));
  if (!order) notFound();
  // a customer that is behind its item (the item was changed) is brought up to date here, so nobody has to press a button
  const caughtUp = order.status === "active" ? syncActiveItems({ orderId: order.id }) : 0;
  const assigned = assignedMasterIds(order.id);
  const masters = listMasters().filter((m) => m.active || assigned.includes(m.id));
  const active = order.status === "active";
  const items = listItems(order.id);
  const shipments = orderShipments(order.id, "submitted");
  const sentItems = new Set(shippableItems(order.id).filter((x) => x.shippedIn !== null).map((x) => x.id));
  const editorItems: EditorItem[] = items.map((i) => ({
    key: String(i.id),
    label: i.label,
    colour: i.snapshot.colour,
    fields: i.snapshot.fields,
    values: i.values,
    removable: !sentItems.has(i.id),
    extra: <AdminItemExtras item={i} />,
    summary: itemSummary(i),
    progress: itemProgress(i),
    facts: itemFacts(i),
    photos: referencePhotos(i.id).map((r) => ({ id: r.id, fieldKey: r.fieldKey ?? "" })),
  }));
  const history = orderHistory(order.id);
  const canRemake = order.status !== "cancelled" && !(order.status === "archived" && order.archivedFrom === "cancelled");
  const linked = linkedOrders(order.designNumber);
  const main = orderOfDesign(order.linkedDesignNumber);
  const templates = pickerGroups().flatMap((g) => g.items.map((t) => ({ ...t, group: g.name })));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-rule bg-paper-2 px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title normal-case">
            #{order.orderNumber} {order.customerName}
          </h1>
          {order.designNumber && <span className="rounded-lg bg-accent-soft px-2.5 py-1 text-sm font-medium text-accent-deep">{order.designNumber}</span>}
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium capitalize ${
              order.status === "active" ? "bg-ok-soft text-ok" : order.status === "completed" ? "bg-accent-soft text-accent-deep" : "bg-bad-soft text-bad"
            }`}
          >
            <span aria-hidden className="h-2 w-2 rounded-full bg-current" />
            {order.status}
          </span>
        </div>
        <Link href={`/admin/orders/${order.id}/print`} className={btnSecondary}>
          <Icon name="note" className="h-4 w-4" /> Print / PDF
        </Link>
      </header>
      {(order.linkedDesignNumber || linked.length > 0) && (
        <div className="space-y-1 rounded-2xl border border-rule bg-paper-2 px-5 py-3 text-base shadow-sm">
          {order.linkedDesignNumber && (
            <p>
              Linked to design number <b className="font-medium">{order.linkedDesignNumber}</b>
              {main && (
                <>
                  {": "}
                  <Link href={`/admin/orders/${main.id}`} className="link font-medium">
                    #{main.orderNumber} {main.customerName}
                  </Link>
                </>
              )}
            </p>
          )}
          {linked.length > 0 && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Linked orders:</span>
              {linked.map((l) => (
                <Link key={l.id} href={`/admin/orders/${l.id}`} className="link font-medium">
                  #{l.orderNumber} {l.customerName}
                </Link>
              ))}
            </p>
          )}
        </div>
      )}
      {updated && <Notice tone="success">Updated from the item. The master will see it was changed.</Notice>}
      {caughtUp > 0 && <Notice tone="success">Brought up to date with the latest form and steps. Your entries are kept. Check any new fields.</Notice>}
      {removed && <Notice tone="success">The item was removed.</Notice>}
      {e && REFRESH_ERRORS[e] && <Notice tone="error">{REFRESH_ERRORS[e]}</Notice>}
      {shipments.length > 0 && (
        <div className="space-y-1 panel text-base">
          <b>Shipments</b>
          {shipments.map((sh) => (
            <p key={sh.id}>
              {fmtDate(sh.submittedAt)}: {sh.items.map((i) => (i.returned ? `${i.label} (sent back for a remake)` : i.label)).join(", ")}{" "}
              {sh.billPhotoId && (
                <a href={`/api/admin/photos/${sh.billPhotoId}`} target="_blank" rel="noreferrer" className="link">
                  Open bill
                </a>
              )}
            </p>
          ))}
        </div>
      )}
      {/* Remake items and History side by side (one under the other on a phone) */}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        {canRemake && (
          <RemakeBox orderId={order.id} items={items.map((i) => ({ id: i.id, label: i.label, sent: sentItems.has(i.id), times: remakeCount(i.id) }))} />
        )}
        <details className={`group rounded-2xl border border-rule bg-paper-2 shadow-sm ${canRemake ? "" : "md:col-span-2"}`}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-5 py-3 text-base font-medium [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-deep">
              <Icon name="clock" className="h-5 w-5" />
            </span>
            <span className="flex-1">
              History
              <span className="block text-sm font-normal text-muted">Everything that happened on this customer</span>
            </span>
            <span className="rounded-full bg-paper-3 px-3 text-base">{history.length}</span>
            <Icon name="chevron" className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-2 border-t border-rule px-5 py-4">
            <HistoryList lines={history} />
          </div>
        </details>
      </div>
      {order.masterEditedAt && (
        <div role="status" className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-accent to-[#7C3AED] px-5 py-4 text-white shadow-sm">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20">
            <Icon name="info" className="h-5 w-5" />
          </span>
          <p className="text-base">
            <b className="font-medium">The master added information on {fmtDate(order.masterEditedAt)}.</b>
            <span className="block text-white/85">See it in the fields below.</span>
          </p>
        </div>
      )}
      <p className="flex items-center gap-2 text-sm text-muted">
        <Icon name="clock" className="h-4 w-4 shrink-0" />
        {order.masterSeenAt
          ? `Master first opened it ${fmtDate(order.masterSeenAt)}; last ${fmtDate(order.masterLastSeenAt)}.`
          : "Master has not opened it yet."}
        {order.confirmedAt ? ` Confirmed he has seen it on ${fmtDate(order.confirmedAt)}.` : " Has not confirmed yet."}
      </p>

      {active ? (
        <>
          <OrderEditor
            action={saveOrderAction}
            masters={masters.map((m) => ({ id: m.id, name: m.name }))}
            base={{ ...order, masterIds: assigned }}
            items={editorItems}
            orderId={order.id}
            submitLabel="Save changes"
            formId="order-form"
            pdfs={listOrderFiles(order.id).map((p) => ({ id: p.id, name: p.name, bytes: p.bytes }))}
            designNumbers={listDesignNumbers(order.id).map((d) => ({ designNumber: d.designNumber, orderNumber: d.orderNumber, customerName: d.customerName }))}
            afterMasters={<AddItemBox orderId={order.id} options={templates.map((t) => ({ templateId: t.templateId, label: `${t.group} > ${t.name}` }))} />}
          />


          {/* last on the page, but part of the customer form above (form="order-form"), so Save changes saves it */}
          <Field label="Extra notes for this customer">
            <textarea name="details" form="order-form" rows={5} defaultValue={order.details} className={textarea} />
          </Field>

          {/* the controls of "Add another item" sit in the form above, under the masters, and send to this empty form */}
          <form id={ADD_ITEM_FORM} action={addItemAction} />
          {/* the Remove buttons sit inside each item above and send to this form */}
          {/* the step and update buttons inside each item send to these two */}
          <form id={STEP_FORM} action={stepAdminAction}>
            <input type="hidden" name="orderId" value={order.id} />
          </form>
          <form id={NOTE_FORM} action={stepNoteAction}>
            <input type="hidden" name="orderId" value={order.id} />
          </form>
          <form id={INSTRUCTION_FORM} action={instructionAction}>
            <input type="hidden" name="orderId" value={order.id} />
          </form>
          <form id={REFRESH_FORM} action={refreshItemAction}>
            <input type="hidden" name="orderId" value={order.id} />
          </form>
          <form id="remove-item-form" action={removeItemAction}>
            <input type="hidden" name="orderId" value={order.id} />
          </form>

          <div className="flex flex-wrap gap-3">
            <button type="submit" form="order-form" className={btnPrimary}>
              Save changes
            </button>
            <form action={setStatusAction}>
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="status" value="completed" />
              <button className={btnPrimary}>Mark complete</button>
            </form>
            <form action={setStatusAction}>
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="status" value="cancelled" />
              <button className={btnDanger}>Cancel order</button>
            </form>
          </div>
        </>
      ) : (
        <div className="space-y-4 text-base">
          <div className="panel grid grid-cols-1 gap-3 sm:grid-cols-3">
            <p>
              <span className="block text-muted">Customer</span>
              <b className="text-lg">{order.customerName}</b>
            </p>
            <p>
              <span className="block text-muted">My due date</span>
              <b className="text-lg">{order.myDueDate}</b>
            </p>
            <p>
              <span className="block text-muted">Karigar due date</span>
              <b className="text-lg">{order.karigarDueDate}</b>
            </p>
          </div>
          {items.map((i) => (
            <div key={i.id} className="panel">
              <b className="text-lg">{i.label}</b>
              {i.snapshot.fields.map((f) => {
                const v = displayValue(f, i.values[f.key]);
                return v ? (
                  <p key={f.key}>
                    {f.label}: {v}
                  </p>
                ) : null;
              })}
            </div>
          ))}
          <p className="whitespace-pre-wrap">{order.details}</p>
          {order.status !== "archived" && (
            <form action={setStatusAction}>
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="status" value="archived" />
              <button className={btnSecondary}>Archive</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
