import Link from "next/link";
import { PinForm } from "@/components/PinForm";
import { PositionTile, card, chipAttention } from "@/components/ui";
import { BAND_CLASS, BAND_LABEL } from "@/lib/colour";
import { linkState, requireMaster } from "@/lib/master-session";
import { masterDashboard } from "@/lib/orders";

export default async function MasterHome({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { token } = await params;
  const { e } = await searchParams;

  const state = await linkState(token);
  if (state === "invalid") return <p className="text-xl">This link is not valid. Ask Anas for a new link.</p>;
  if (state === "need-pin") return <PinForm token={token} error={e} />;

  const master = (await requireMaster(token))!;
  const { active, closed } = masterDashboard(master.id);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title text-4xl">Hello {master.name}</h1>
        <p className="text-lg">{active.length === 0 ? "No orders right now." : "Do your orders in this order. Start with number 1."}</p>
      </header>

      <ul className="space-y-3">
        {active.map((o, i) => (
          <li key={o.id}>
            <Link href={`/m/${token}/orders/${o.id}`} className={`${card} flex items-center gap-4 border-l-4 ${BAND_CLASS[o.band]}`}>
              <PositionTile n={i + 1} />
              <span className="min-w-0 flex-1">
                <span className="block break-words text-lg font-medium">
                  #{o.orderNumber} {o.customerName}
                </span>
                <span className="block text-lg whitespace-nowrap">Due {o.karigarDueDate}</span>
                <span className={`block text-base font-medium ${o.flags.overdue ? "text-thread" : BAND_LABEL[o.band].className}`}>
                  {o.flags.overdue
                    ? `Late by ${o.flags.daysOverdue} day${o.flags.daysOverdue === 1 ? "" : "s"}`
                    : BAND_LABEL[o.band].text}
                </span>
                {o.flags.stale && <span className="block text-base font-medium text-thread">Please send an update</span>}
                {o.progress.total > 0 && (
                  <span className="block text-base">
                    Steps done: {o.progress.done} of {o.progress.total}
                  </span>
                )}
              </span>
              {o.badge && <span className={`${chipAttention} self-start`}>{o.badge}</span>}
            </Link>
          </li>
        ))}
      </ul>

      {closed.length > 0 && (
        <section className="space-y-3">
          <h2 className="pt-2 text-2xl font-medium">Finished</h2>
          <ul className="space-y-3">
            {closed.map((o) => (
              <li key={o.id}>
                <Link href={`/m/${token}/orders/${o.id}`} className={`${card} block`}>
                  <span className="block text-xl font-medium">
                    #{o.orderNumber} {o.customerName}
                  </span>
                  <span className={`block text-lg font-medium ${o.status === "cancelled" ? "text-thread" : "text-leaf"}`}>
                    {o.status === "cancelled" ? "Cancelled. Stop work." : "Completed"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
