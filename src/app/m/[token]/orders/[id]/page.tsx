import Link from "next/link";
import { notFound } from "next/navigation";
import { PinForm } from "@/components/PinForm";
import { btnPrimary, fmtDay } from "@/components/ui";
import { linkState, requireMaster } from "@/lib/master-session";
import { markSeen, masterItems, masterOrder } from "@/lib/orders";
import { MasterStages } from "@/components/MasterStages";
import { MasterItemFields } from "@/components/MasterItemFields";
import { StageTrack } from "@/components/StageTrack";
import { DesignPictures } from "@/components/DesignPictures";
import { designFieldKeys } from "@/lib/items";
import { itemTrack, openStepGroups } from "@/lib/track";
import { completeOrderAction, completeStepAllAction } from "../../../actions";
import { Icon } from "@/components/Icon";

export default async function MasterOrder({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; id: string }>;
  searchParams: Promise<{ e?: string; saved?: string; all?: string; skip?: string; what?: string }>;
}) {
  const { token, id } = await params;
  const { e, saved, all, skip, what } = await searchParams;

  const state = await linkState(token);
  if (state === "invalid") return <p className="text-xl">This link is not valid. Ask Anas for a new link.</p>;
  if (state === "need-pin") return <PinForm token={token} />;

  const master = (await requireMaster(token))!;
  const order = masterOrder(master.id, Number(id));
  if (!order) notFound();
  markSeen(master.id, order.id);
  const items = masterItems(order.id);
  const groups = openStepGroups(order.id);

  // "Design: ..." from the first filled field whose name starts with Design (for example Design number)
  const design = items
    .flatMap((it) => it.snapshot.fields.filter((f) => /^design/i.test(f.label) && f.type !== "picture").map((f) => it.values[f.key]))
    .find((v) => v && v.trim());
  const today = new Date();
  const [dy, dm, dd] = order.karigarDueDate.split("-").map(Number);
  const daysLeft = Math.round((new Date(dy, dm - 1, dd).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);

  return (
    <div className="space-y-4">
      <Link href={`/m/${token}`} className="link inline-flex min-h-12 items-center gap-2 text-lg font-medium">
        <Icon name="arrow" className="h-4 w-4 rotate-180" /> Back
      </Link>
      <section className="panel space-y-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title normal-case">Order #{order.orderNumber}</h1>
            <span className={`rounded-full px-3 py-1 text-base font-medium text-white ${order.status === "active" ? "bg-accent" : order.status === "completed" ? "bg-leaf" : "bg-thread"}`}>
              {order.status === "active" ? "In Progress" : order.status === "completed" ? "Completed" : "Cancelled"}
            </span>
          </div>

          <dl className="space-y-2 text-xl">
            <div className="flex gap-2">
              <dt className="text-muted">Customer:</dt>
              <dd className="font-medium">{order.customerName}</dd>
            </div>
            {design && (
              <div className="flex gap-2">
                <dt className="text-muted">Design:</dt>
                <dd className="font-medium">{design}</dd>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-muted">Due date:</dt>
              <dd className="font-medium">{fmtDay(order.karigarDueDate)}</dd>
              {order.status === "active" && (
                <span className={`rounded-full px-3 py-0.5 text-base font-medium text-white ${daysLeft <= 0 ? "bg-thread" : daysLeft <= 3 ? "bg-leaf" : "bg-cloth"}`}>
                  {daysLeft < 0 ? `Late by ${-daysLeft} ${daysLeft === -1 ? "day" : "days"}` : daysLeft === 0 ? "Due today" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}
                </span>
              )}
            </div>
          </dl>

          {items.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {items.map((it) => (
                <span key={it.id} className="inline-flex items-center gap-2 rounded-full bg-paper-3 px-3 py-1 text-lg font-medium">
                  <span className="inline-block h-4 w-4 rounded-full" style={{ background: it.snapshot.colour }} />
                  {it.label}
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {[
              { href: `/api/m/${token}/orders/${order.id}/pdf`, icon: "download", text: "PDF", native: true },
              { href: `/m/${token}/orders/${order.id}/print`, icon: "note", text: "Print", native: false },
              { href: `/m/${token}/orders/${order.id}/ship`, icon: "shipments", text: "Send", native: false },
            ].map((b) => {
              const cls = "flex flex-col items-center gap-1 rounded-2xl bg-accent-soft px-2 py-3 text-lg font-medium text-accent-deep";
              const inner = (
                <>
                  <Icon name={b.icon} className="h-7 w-7" />
                  {b.text}
                </>
              );
              return b.native ? (
                <a key={b.text} href={b.href} className={cls}>
                  {inner}
                </a>
              ) : (
                <Link key={b.text} href={b.href} className={cls}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {order.status === "cancelled" && (
        <p role="alert" className="alert alert-error text-xl font-medium">Cancelled - stop work</p>
      )}
      {order.status === "completed" && (
        <p role="status" className="alert alert-success text-xl font-medium">Completed</p>
      )}

      {saved && <p role="status" className="alert alert-success text-lg font-medium">Saved. Anas can see it.</p>}

      {all !== undefined && (
        <p role="status" className="alert alert-success text-lg font-medium">
          {what}: finished on {all} {all === "1" ? "item" : "items"}.
          {Number(skip) > 0 && ` ${skip} ${skip === "1" ? "item was" : "items were"} skipped: it still needs something first (see its steps below).`}
        </p>
      )}

      {order.canComplete && groups.length > 0 && (
        <section className="panel space-y-3">
          <h2 className="text-xl font-medium">Finish a step for all items</h2>
          <p className="text-base text-muted">The same step is open on several items. Do it once here instead of on each item.</p>
          {groups.map((g) => {
            const waiting = g.items.filter((i) => !i.ready);
            return (
              <form key={g.label} action={completeStepAllAction} className="space-y-2 rounded-2xl bg-accent-soft p-4">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="label" value={g.label} />
                <p className="text-lg font-medium">
                  {g.label}: {g.items.map((i) => i.itemLabel).join(", ")}
                </p>
                {waiting.length > 0 && (
                  <p className="text-base text-thread">
                    Not ready, will be skipped: {waiting.map((i) => i.itemLabel).join(", ")} (it needs an image or a field first).
                  </p>
                )}
                <button className={`${btnPrimary} w-full`} disabled={waiting.length === g.items.length}>
                  Mark {g.label} complete for {g.items.length - waiting.length} {g.items.length - waiting.length === 1 ? "item" : "items"}
                </button>
              </form>
            );
          })}
        </section>
      )}

      {items.map((item) => (
        <section key={item.id} className="panel space-y-3" style={{ borderColor: item.snapshot.colour }}>
          <h2 className="flex items-center gap-2 text-2xl font-medium">
            <span className="inline-block h-5 w-5 rounded-full" style={{ background: item.snapshot.colour }} />
            {item.label}
          </h2>
          <StageTrack steps={itemTrack(item.id)} />
          <DesignPictures token={token} itemId={item.id} fieldKeys={designFieldKeys(item.snapshot.fields)} />
          <MasterItemFields
            token={token}
            orderId={order.id}
            itemId={item.id}
            snapshot={item.snapshot}
            values={item.values}
            canEdit={order.status === "active"}
          />
          <MasterStages
            token={token}
            orderId={order.id}
            itemId={item.id}
            fields={item.snapshot.fields}
            skipKeys={designFieldKeys(item.snapshot.fields)}
            turn={order.canComplete}
          />
        </section>
      ))}
      {order.details && <p className="panel whitespace-pre-wrap text-lg">{order.details}</p>}

      {e && e !== "not-active" && (
        <p role="alert" className="alert alert-error text-lg font-medium">
          {e === "needs-photo"
            ? "This step needs an approved photo first."
            : e === "needs-fields"
              ? "Some required fields are not filled in yet. Fill them in, then finish the step."
              : "That did not work. Please try again."}
        </p>
      )}
      {e === "not-shipped" && (
        <p role="alert" className="alert alert-error text-lg font-medium">Send the items first. The order closes when everything has been sent.</p>
      )}

      {order.status === "active" &&
        (items.length > 0 ? (
          // an order with items is closed by sending them, so "Mark complete" would only be a way round shipping
          <p className="alert text-lg">This order closes by itself when every item has been sent. Use Shipping above.</p>
        ) : order.canComplete ? (
          <form action={completeOrderAction}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="orderId" value={order.id} />
            <button className={`${btnPrimary} w-full`}>Mark complete</button>
          </form>
        ) : (
          <p className="alert text-lg">
            You can finish this order after the orders above it.
          </p>
        ))}
    </div>
  );
}
