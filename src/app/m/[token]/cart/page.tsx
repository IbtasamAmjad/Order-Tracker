import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PinForm } from "@/components/PinForm";
import { ShipmentFlow } from "@/components/ShipmentFlow";
import { linkState, requireMaster } from "@/lib/master-session";
import { cartCandidates, findDraft } from "@/lib/shipping";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  "no-items": "Choose the items you are sending.",
  "not-ready": "An item you chose is not approved for shipping yet. Wait for the office to approve its photo.",
  "no-bill": "Take a photo of the bill first.",
  "already-shipped": "One of these items was already sent.",
  "not-draft": "This shipment was already sent.",
  blocked: "One of these orders is closed.",
};

/**
 * The cart: every finished item of all this master customers, in one shipment with one bill.
 */
export default async function Cart({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ sent?: string; e?: string }> }) {
  const { token } = await params;
  const { sent, e } = await searchParams;
  const state = await linkState(token);
  if (state === "invalid") return <p className="text-xl">This link is not valid. Ask the office for a new link.</p>;
  if (state === "need-pin") return <PinForm token={token} />;
  const master = (await requireMaster(token))!;

  const candidates = cartCandidates(master.id);
  const draft = findDraft(master.id);
  const anchor = candidates[0]?.orderId ?? 0; // an open order of his, where the bill picture is filed
  const customers = new Set(candidates.map((c) => c.orderId)).size;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <Link href={`/m/${token}`} className="link inline-flex min-h-12 items-center gap-2 text-lg font-medium">
        <Icon name="arrow" className="h-4 w-4 rotate-180" /> Back
      </Link>
      <header>
        <h1 className="page-title text-4xl">Cart</h1>
        <p className="text-lg">
          {candidates.length === 0
            ? "Nothing is ready to send."
            : `${candidates.length} finished item${candidates.length === 1 ? "" : "s"} from ${customers} customer${customers === 1 ? "" : "s"}. They are all ready to go. Take one photo of the bill and send them together.`}
        </p>
      </header>

      {sent && <p className="rounded-2xl bg-leaf p-4 text-xl font-medium text-accent-ink">Sent. The office can see it now.</p>}

      {candidates.length === 0 ? (
        <div className="space-y-3">
          <p className="text-lg">When you finish an item, it appears here, ready to add to the shipment.</p>
          <Link href={`/m/${token}/pending`} className="link inline-flex min-h-12 items-center text-lg font-medium">
            See my pending work
          </Link>
        </div>
      ) : (
        <ShipmentFlow
          token={token}
          orderId={anchor}
          shipmentId={draft?.id ?? null}
          turnOk
          ready={candidates.map((c) => ({ id: c.itemId, label: c.label, sub: `#${c.orderNumber} ${c.customerName}${c.designNumber ? ` - Design: ${c.designNumber}` : ""}` }))}
          initialPicked={candidates.map((c) => c.itemId)}
          billPhotoId={draft?.billPhotoId ?? null}
          packagePhotoId={draft?.packagePhotoId ?? null}
          error={e ? (ERRORS[e] ?? "That did not work. Please try again.") : null}
        />
      )}
    </div>
  );
}
