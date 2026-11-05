import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderEditor } from "@/components/OrderEditor";
import { getOrder, listItems } from "@/lib/orders";
import { orderShipments } from "@/lib/shipping";
import { listMasters } from "@/lib/masters";
import { pickerGroups } from "@/lib/templates";
import type { EditorItem } from "@/lib/editor-state";
import { displayValue } from "@/lib/items";
import { AdminItemExtras } from "@/components/AdminItemExtras";
import { Notice, btnDanger, btnPrimary, btnSecondary, fmtDate, input } from "@/components/ui";
import { addItemAction, allowOutOfSequenceAction, saveOrderAction, setStatusAction } from "../../actions";

const REFRESH_ERRORS: Record<string, string> = {
  "refresh-no-category": "This customer's category was deleted, so it cannot be updated from it.",
  "refresh-closed": "A finished or cancelled customer cannot be updated.",
  "refresh-not-found": "That item was not found.",
};

export default async function EditOrder({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string; e?: string }>;
}) {
  const { updated, e } = await searchParams;
  const order = getOrder(Number((await params).id));
  if (!order) notFound();
  const masters = listMasters().filter((m) => m.active || m.id === order.masterId);
  const active = order.status === "active";
  const items = listItems(order.id);
  const shipments = orderShipments(order.id, "submitted");
  const editorItems: EditorItem[] = items.map((i) => ({
    key: String(i.id),
    label: i.label,
    colour: i.snapshot.colour,
    fields: i.snapshot.fields,
    values: i.values,
  }));
  const templates = pickerGroups().flatMap((g) => g.items.map((t) => ({ ...t, group: g.name })));

  return (
    <div className="space-y-6">
      <h1 className="page-title normal-case">
        #{order.orderNumber} {order.customerName} <span className="ml-2 inline-block rounded-full bg-accent-soft px-3 py-0.5 align-middle text-sm font-medium text-accent-deep capitalize">{order.status}</span>
      </h1>
      {updated && <Notice tone="success">Updated from the category. The master will see it was changed.</Notice>}
      {e && REFRESH_ERRORS[e] && <Notice tone="error">{REFRESH_ERRORS[e]}</Notice>}
      <Link href={`/admin/orders/${order.id}/print`} className={btnSecondary}>
        Print / PDF
      </Link>
      {shipments.length > 0 && (
        <div className="space-y-1 panel text-base">
          <b>Shipments</b>
          {shipments.map((sh) => (
            <p key={sh.id}>
              {fmtDate(sh.submittedAt)}: {sh.items.map((i) => i.label).join(", ")}{" "}
              {sh.billPhotoId && (
                <a href={`/api/admin/photos/${sh.billPhotoId}`} target="_blank" rel="noreferrer" className="link">
                  Open bill
                </a>
              )}
            </p>
          ))}
        </div>
      )}
      {order.masterEditedAt && (
        <p role="status" className="alert alert-info text-lg font-medium">
          The master added information on {fmtDate(order.masterEditedAt)}. See it in the fields below.
        </p>
      )}
      <p className="text-base text-muted">
        {order.masterSeenAt
          ? `Master first opened it ${fmtDate(order.masterSeenAt)}; last ${fmtDate(order.masterLastSeenAt)}.`
          : "Master has not opened it yet."}
      </p>

      {active ? (
        <>
          <OrderEditor
            action={saveOrderAction}
            masters={masters.map((m) => ({ id: m.id, name: m.name }))}
            base={order}
            items={editorItems}
            orderId={order.id}
            submitLabel="Save changes"
          />

          {items.map((i) => (
            <AdminItemExtras key={i.id} orderId={order.id} item={i} />
          ))}

          {templates.length > 0 && (
            <form action={addItemAction} className="space-y-2 panel">
              <input type="hidden" name="orderId" value={order.id} />
              <p className="text-lg font-medium">Add another category for this customer</p>
              <select name="templateId" className={input} aria-label="Category">
                {templates.map((t) => (
                  <option key={t.templateId} value={t.templateId}>
                    {t.group} &gt; {t.name}
                  </option>
                ))}
              </select>
              <button className={btnSecondary}>Add item</button>
            </form>
          )}

          <form action={allowOutOfSequenceAction} className="space-y-2 panel">
            <p className="text-lg">
              {order.allowOutOfSequence
                ? "Master CAN complete this order before earlier ones."
                : "Master must finish earlier orders first."}
            </p>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="allow" value={order.allowOutOfSequence ? "0" : "1"} />
            <button className={btnSecondary}>
              {order.allowOutOfSequence ? "Stop allowing" : "Allow before earlier orders"}
            </button>
          </form>

          <div className="flex flex-wrap gap-3">
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
          <div className="panel grid gap-3 sm:grid-cols-3">
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
