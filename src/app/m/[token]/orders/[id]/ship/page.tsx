import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadLink } from "@/components/DownloadLink";
import { Icon } from "@/components/Icon";
import { PinForm } from "@/components/PinForm";
import { LockedItems, ShipmentFlow } from "@/components/ShipmentFlow";
import { fmtDate } from "@/components/ui";
import { linkState, requireMaster } from "@/lib/master-session";
import { masterOrder } from "@/lib/orders";
import { canMasterShip, findDraft, orderShipments, shippableItems } from "@/lib/shipping";

const ERRORS: Record<string, string> = {
  "no-items": "Tick the items you are sending.",
  "not-ready": "An item you ticked is not approved for shipping yet. Wait for Anas to approve its photo.",
  "no-bill": "Take a photo of the bill first.",
  "already-shipped": "One of these items was already sent.",
  "not-draft": "This shipment was already sent.",
};

export default async function ShipHome({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; id: string }>;
  searchParams: Promise<{ sent?: string; e?: string }>;
}) {
  const { token, id } = await params;
  const { sent, e } = await searchParams;

  const state = await linkState(token);
  if (state === "invalid") return <p className="text-xl">This link is not valid. Ask Anas for a new link.</p>;
  if (state === "need-pin") return <PinForm token={token} />;

  const master = (await requireMaster(token))!;
  const order = masterOrder(master.id, Number(id));
  if (!order) notFound();

  const items = shippableItems(order.id);
  const left = items.filter((i) => i.shippedIn === null);
  const readyItems = left.filter((i) => i.ready);
  const lockedItems = left.filter((i) => !i.ready);
  const submitted = orderShipments(order.id, "submitted");

  // The shipment is one page. An open draft is shown if there is one; looking at this page never makes one.
  const draft = order.status === "active" && readyItems.length > 0 ? findDraft(master.id, order.id) : null;
  const turnOk = canMasterShip(master.id, order.id);

  return (
    <div className="space-y-5">
      <Link href={`/m/${token}/orders/${order.id}`} className="link inline-flex min-h-12 items-center gap-2 text-lg font-medium">
        <Icon name="arrow" className="h-4 w-4 rotate-180" /> Back
      </Link>
      <h1 className="page-title">Shipping - Order #{order.orderNumber}</h1>

      {sent && <p className="rounded-2xl bg-leaf p-4 text-xl font-medium text-accent-ink">Sent. Anas can see it now.</p>}
      {order.status === "completed" && <p className="text-lg">All items of this order have been sent.</p>}
      {items.length === 0 && <p className="text-lg">This order has no items to ship.</p>}

      {order.status === "active" && left.length > 0 && (
        readyItems.length > 0 ? (
          <ShipmentFlow
            token={token}
            orderId={order.id}
            shipmentId={draft?.id ?? null}
            turnOk={turnOk}
            ready={readyItems.map((i) => ({ id: i.id, label: i.label }))}
            locked={lockedItems.map((i) => ({ id: i.id, label: i.label, blockers: i.blockers }))}
            initialPicked={draft?.items.map((i) => i.itemId) ?? []}
            billPhotoId={draft?.billPhotoId ?? null}
            packagePhotoId={draft?.packagePhotoId ?? null}
            error={e ? (ERRORS[e] ?? "That did not work. Please try again.") : null}
          />
        ) : (
          <div className="space-y-3">
            <p className="text-lg">Nothing can be sent yet. Finish what is listed below first.</p>
            <LockedItems items={lockedItems.map((i) => ({ id: i.id, label: i.label, blockers: i.blockers }))} />
          </div>
        )
      )}

      {submitted.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xl font-medium">Already sent</h2>
          <ul className="space-y-2">
            {submitted.map((s) => (
              <li key={s.id} className="panel text-lg">
                <div className="font-medium">{fmtDate(s.submittedAt)}</div>
                <div>{s.items.map((i) => i.label).join(", ")}</div>
                {s.billPhotoId && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <a href={`/api/m/${token}/photos/${s.billPhotoId}`} target="_blank" rel="noreferrer" className="link">
                      Open bill
                    </a>
                    <DownloadLink href={`/api/m/${token}/photos/${s.billPhotoId}`} label="Download bill" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
