import Link from "next/link";
import { notFound } from "next/navigation";
import { PinForm } from "@/components/PinForm";
import { TitleIcon, btnPrimary, fmtDay } from "@/components/ui";
import { linkState, requireMaster } from "@/lib/master-session";
import { markSeen, masterItems, masterOrder } from "@/lib/orders";
import { MasterStages } from "@/components/MasterStages";
import { MasterItemFields } from "@/components/MasterItemFields";
import { StageTrack } from "@/components/StageTrack";
import { DesignPictures } from "@/components/DesignPictures";
import { designFieldKeys } from "@/lib/items";
import { itemTrack } from "@/lib/track";
import { completeOrderAction, confirmOrderAction } from "../../../actions";
import { HistoryList } from "@/components/HistoryList";
import { orderHistory } from "@/lib/history";
import { Icon } from "@/components/Icon";
import { listOrderFiles } from "@/lib/order-files";
import { cartCandidates } from "@/lib/shipping";
import { remakeCount } from "@/lib/remake";
import { itemStatesOfOrder, itemStatesSummary } from "@/lib/item-search";

export default async function MasterOrder({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; id: string }>;
  searchParams: Promise<{ e?: string; saved?: string; noted?: string }>;
}) {
  const { token, id } = await params;
  const { e, saved, noted } = await searchParams;

  const state = await linkState(token);
  if (state === "invalid") return <p className="text-xl">This link is not valid. Ask the office for a new link.</p>;
  if (state === "need-pin") return <PinForm token={token} />;

  const master = (await requireMaster(token))!;
  const order = masterOrder(master.id, Number(id));
  if (!order) notFound();
  markSeen(master.id, order.id);
  const items = masterItems(order.id);
  const states = itemStatesOfOrder(order.id);
  const readyItems = new Set(cartCandidates(master.id).map((c) => c.itemId)); // finished items that can go in the cart
  const history = orderHistory(order.id);

  // "Design: ..." from the first filled field whose name starts with Design (for example Design number)
  const design = order.designNumber || items
    .flatMap((it) => it.snapshot.fields.filter((f) => /^design/i.test(f.label) && f.type !== "picture").map((f) => it.values[f.key]))
    .find((v) => v && v.trim());
  const today = new Date();
  const [dy, dm, dd] = order.karigarDueDate.split("-").map(Number);
  const daysLeft = Math.round((new Date(dy, dm - 1, dd).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);

  const orderPdfs = listOrderFiles(order.id);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Link href={`/m/${token}`} className="link inline-flex min-h-12 items-center gap-2 text-lg font-medium">
        <Icon name="arrow" className="h-4 w-4 rotate-180" /> Back
      </Link>
      <section className="panel space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-3">
            <TitleIcon name="note" />
            <h1 className="page-title normal-case">Order #{order.orderNumber}</h1>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-base font-medium ${
              order.status === "active"
                ? "border-ok/30 bg-ok-soft text-ok"
                : order.status === "completed"
                  ? "border-accent/30 bg-accent-soft text-accent-deep"
                  : "border-bad/30 bg-bad-soft text-bad"
            }`}
          >
            <Icon name="check" className="h-4 w-4" />
            {order.status === "active" ? "In Progress" : order.status === "completed" ? "Completed" : "Cancelled"}
          </span>
        </div>

        <dl className="space-y-1.5 border-t border-rule pt-4 text-xl">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted">Customer</dt>
            <dd className="text-right font-medium">{order.customerName}</dd>
          </div>
          {design && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">Design</dt>
              <dd className="text-right font-medium">{design}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted">Due date</dt>
            <dd className="text-right font-medium">{fmtDay(order.karigarDueDate)}</dd>
          </div>
        </dl>

        {order.status === "active" && (
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-base font-medium ${
              daysLeft <= 0 ? "border-bad/30 bg-bad-soft text-bad" : daysLeft <= 3 ? "border-ok/30 bg-ok-soft text-ok" : "border-cloth/30 bg-cool-soft text-cloth"
            }`}
          >
            <Icon name="clock" className="h-4 w-4" />
            {daysLeft < 0 ? `Late by ${-daysLeft} ${daysLeft === -1 ? "day" : "days"}` : daysLeft === 0 ? "Due today" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}
          </span>
        )}

        {states.length > 0 && (
          <div className="space-y-2 border-t border-rule pt-4">
            <p className="text-lg font-medium">{itemStatesSummary(states)}</p>
            <ul className="space-y-2">
              {states.map((it) => (
                <li key={it.itemId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-rule bg-paper-3/60 px-3 py-2 text-lg">
                  <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: it.colour }} />
                  <span className="flex-1 font-medium">{it.label}</span>
                  {it.state === "sent" && <span className="rounded-full bg-cool-soft px-3 py-0.5 text-base font-medium text-cloth">Sent</span>}
                  {it.state === "ready" && (
                    <Link href={`/m/${token}/cart`} className="rounded-full bg-ok-soft px-3 py-0.5 text-base font-medium text-ok">
                      Finished, in your cart
                    </Link>
                  )}
                  {it.state === "making" && <span className="rounded-full bg-[#FEF3C7] px-3 py-0.5 text-base font-medium text-[#92400E]">To make{it.stage ? `: ${it.stage}` : ""}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {orderPdfs.length > 0 && (
          <div className="space-y-2 border-t border-rule pt-4">
            <p className="text-lg font-medium">Order PDF</p>
            {orderPdfs.map((p) => (
              <a
                key={p.id}
                href={`/api/m/${token}/orders/${order.id}/files/${p.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-12 items-center gap-2 rounded-xl border-2 border-accent bg-accent-soft px-3 text-lg font-medium text-accent-deep"
              >
                <Icon name="note" className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 break-words">View {p.name}</span>
              </a>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 border-t border-rule pt-4">
          {[
            { href: `/api/m/${token}/orders/${order.id}/pdf`, icon: "download", text: "PDF", native: true },
            { href: `/m/${token}/orders/${order.id}/print`, icon: "note", text: "Print", native: false },
            { href: `/m/${token}/cart`, icon: "shipments", text: "Cart", native: false },
          ].map((b) => {
            const cls = "flex min-h-12 items-center justify-center gap-2 rounded-xl border border-rule-2 bg-paper-2 px-2 text-lg font-medium text-ink hover:bg-paper-3";
            const inner = (
              <>
                <Icon name={b.icon} className="h-5 w-5 text-muted" />
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
      </section>

      {order.status === "cancelled" && (
        <p role="alert" className="alert alert-error text-xl font-medium">Cancelled - stop work</p>
      )}
      {order.status === "completed" && (
        <p role="status" className="alert alert-success text-xl font-medium">Completed</p>
      )}

      {saved && <p role="status" className="alert alert-success text-lg font-medium">Saved. The office can see it.</p>}
      {noted && <p role="status" className="alert alert-success text-lg font-medium">Note added.</p>}

      {order.status === "active" && !order.confirmedAt && (
        <section className="panel space-y-3 !border-2 !border-accent">
          <h2 className="text-2xl font-medium">Please confirm you have seen this order</h2>
          <p className="text-lg">Press the button to tell the office you have it. Then you can finish steps.</p>
          <form action={confirmOrderAction}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="orderId" value={order.id} />
            <button className={`${btnPrimary} w-full`}>I have seen this order</button>
          </form>
        </section>
      )}

      {items.map((item) => (
        <section key={item.id} className="panel" style={{ borderColor: item.snapshot.colour }}>
          {/* tap the name to minimize or open the item; the progress bar stays in view when it is closed */}
          <details open={items.length <= 2} className="group">
            <summary className="cursor-pointer list-none space-y-3 [&::-webkit-details-marker]:hidden" title="Tap to minimize or open">
              <div className="flex items-center gap-2">
                <span className="inline-block h-5 w-5 shrink-0 rounded-full" style={{ background: item.snapshot.colour }} />
                <div className="min-w-0 flex-1">
                  <h2 className="flex flex-wrap items-center gap-2 text-2xl font-medium">
                    {item.label}
                    {remakeCount(item.id) > 0 && <span className="rounded-full bg-bad-soft px-3 py-0.5 text-sm font-medium text-bad">Remake</span>}
                  </h2>
                  <p className="text-base text-muted">
                    {order.customerName}
                    {order.designNumber ? ` - Design: ${order.designNumber}` : ""}
                  </p>
                </div>
                <Icon name="chevron" className="h-6 w-6 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </div>
              <StageTrack steps={itemTrack(item.id)} />
            </summary>
            <div className="mt-4 space-y-3">
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
                confirmed={!!order.confirmedAt}
              />
            </div>
          </details>
          {order.status === "active" && readyItems.has(item.id) && (
            <Link
              href={`/m/${token}/cart`}
              className="mt-3 flex min-h-12 items-center gap-2 rounded-2xl bg-ok-soft px-4 py-2 text-lg font-medium text-ok"
            >
              <Icon name="shipments" className="h-5 w-5 shrink-0" />
              <span className="flex-1">Finished. It is in your cart, ready to send.</span>
              <Icon name="arrow" className="h-4 w-4 shrink-0" />
            </Link>
          )}
        </section>
      ))}
      {order.details && <p className="panel whitespace-pre-wrap text-lg">{order.details}</p>}

      {e === "note-empty" && <p role="alert" className="alert alert-error text-lg font-medium">Write something in the note first.</p>}
      {e === "not-confirmed" && <p role="alert" className="alert alert-error text-lg font-medium">Press &quot;I have seen this order&quot; first.</p>}
      {e && e !== "not-active" && e !== "note-empty" && e !== "not-confirmed" && (
        <p role="alert" className="alert alert-error text-lg font-medium">
          {e === "needs-photo"
            ? "This step needs an approved photo first."
            : e === "needs-fields"
              ? "Some required fields are empty. Fill them in, then finish the step."
              : "That did not work. Please try again."}
        </p>
      )}
      {e === "not-shipped" && (
        <p role="alert" className="alert alert-error text-lg font-medium">Send the items first. The order closes when all are sent.</p>
      )}

      {order.status === "active" &&
        (items.length > 0 ? (
          // an order with items is closed by sending them, so "Mark complete" would only be a way round shipping
          <p className="alert text-lg">This order closes when every item is sent. Use the Cart.</p>
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

      <section className="panel">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xl font-medium [&::-webkit-details-marker]:hidden">
            <span className="flex-1">History</span>
            <span className="rounded-full bg-paper-3 px-3 text-base">{history.length}</span>
            <Icon name="chevron" className="h-5 w-5 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3">
            <HistoryList lines={history} />
          </div>
        </details>
      </section>
    </div>
  );
}
