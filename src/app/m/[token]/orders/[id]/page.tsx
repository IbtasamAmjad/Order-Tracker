import Link from "next/link";
import { notFound } from "next/navigation";
import { PinForm } from "@/components/PinForm";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { linkState, requireMaster } from "@/lib/master-session";
import { markSeen, masterItems, masterOrder } from "@/lib/orders";
import { MasterStages } from "@/components/MasterStages";
import { MasterItemFields } from "@/components/MasterItemFields";
import { completeOrderAction } from "../../../actions";
import { Icon } from "@/components/Icon";

export default async function MasterOrder({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; id: string }>;
  searchParams: Promise<{ e?: string; saved?: string }>;
}) {
  const { token, id } = await params;
  const { e, saved } = await searchParams;

  const state = await linkState(token);
  if (state === "invalid") return <p className="text-xl">This link is not valid. Ask Anas for a new link.</p>;
  if (state === "need-pin") return <PinForm token={token} />;

  const master = (await requireMaster(token))!;
  const order = masterOrder(master.id, Number(id));
  if (!order) notFound();
  markSeen(master.id, order.id);
  const items = masterItems(order.id);

  return (
    <div className="space-y-4">
      <Link href={`/m/${token}`} className="link inline-flex min-h-12 items-center gap-2 text-lg font-medium">
        <Icon name="arrow" className="h-4 w-4 rotate-180" /> Back
      </Link>
      <h1 className="page-title">Order #{order.orderNumber}</h1>
      <div className="grid gap-2 sm:grid-cols-2">
        <a href={`/api/m/${token}/orders/${order.id}/pdf`} className={`${btnPrimary} w-full`}>
          Download PDF
        </a>
        <Link href={`/m/${token}/orders/${order.id}/print`} className={`${btnSecondary} w-full`}>
          Print
        </Link>
      </div>
      <Link href={`/m/${token}/orders/${order.id}/ship`} className={`${btnSecondary} w-full`}>
        Shipping
      </Link>

      {order.status === "cancelled" && (
        <p role="alert" className="alert alert-error text-xl font-medium">Cancelled - stop work</p>
      )}
      {order.status === "completed" && (
        <p role="status" className="alert alert-success text-xl font-medium">Completed</p>
      )}

      {saved && <p role="status" className="alert alert-success text-lg font-medium">Saved. Anas can see it.</p>}

      <div className="space-y-1 text-xl">
        <p>
          <b>Customer:</b> {order.customerName}
        </p>
        <p>
          <b>Due date:</b> {order.karigarDueDate}
        </p>
      </div>
      {items.map((item) => (
        <section key={item.id} className="panel space-y-3" style={{ borderColor: item.snapshot.colour }}>
          <h2 className="flex items-center gap-2 text-2xl font-medium">
            <span className="inline-block h-5 w-5 rounded-full" style={{ background: item.snapshot.colour }} />
            {item.label}
          </h2>
          <MasterItemFields
            token={token}
            orderId={order.id}
            orderNumber={order.orderNumber}
            itemId={item.id}
            label={item.label}
            snapshot={item.snapshot}
            values={item.values}
            canEdit={order.status === "active"}
          />
          <MasterStages
            token={token}
            orderId={order.id}
            itemId={item.id}
            fields={item.snapshot.fields}
            turn={order.canComplete}
          />
        </section>
      ))}
      {order.details && <p className="panel whitespace-pre-wrap text-lg">{order.details}</p>}

      {e && e !== "blocked" && e !== "not-active" && (
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
      {e === "blocked" && (
        <p role="alert" className="alert alert-error text-lg font-medium">Finish the orders above this one first.</p>
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
