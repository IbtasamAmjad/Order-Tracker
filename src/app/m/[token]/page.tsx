import Link from "next/link";
import { PinForm } from "@/components/PinForm";
import { StageTrack } from "@/components/StageTrack";
import { PositionTile, btnPrimary, card, chipAttention, fmtDay } from "@/components/ui";
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
        <p className="text-lg">{active.length === 0 ? "No orders right now." : "Open an order to work on it. Any order can be done first."}</p>
      </header>

      <ul className="space-y-4">
        {active.map((o, i) => {
          const late = o.flags.overdue;
          const status = late ? `Late by ${o.flags.daysOverdue} day${o.flags.daysOverdue === 1 ? "" : "s"}` : BAND_LABEL[o.band].text;
          const pill = late || o.band === "red" ? "bg-thread" : o.band === "green" ? "bg-leaf" : "bg-cloth";
          return (
            <li key={o.id} className={`${card} space-y-3 border-l-4 ${late ? "border-l-thread" : BAND_CLASS[o.band]}`}>
              <div className="flex items-start gap-3">
                <PositionTile n={i + 1} />
                <Link href={`/m/${token}/orders/${o.id}`} className="group min-w-0 flex-1" aria-label={`Open order ${o.orderNumber}, ${o.customerName}`}>
                  <p className="break-words text-xl font-medium leading-snug group-hover:underline">
                    #{o.orderNumber} - {o.customerName}
                  </p>
                  <p className="text-base text-muted">
                    {o.itemLabels.length > 0 ? o.itemLabels.join(", ") : "No items yet"}
                  </p>
                </Link>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-3 py-1 text-sm font-medium text-white ${pill}`}>{status}</span>
                  {o.badge && <span className={chipAttention}>{o.badge}</span>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-base">
                <span className="rounded-full bg-paper-3 px-3 py-1 font-medium">Due {fmtDay(o.karigarDueDate)}</span>
                {o.progress.total > 0 && (
                  <span className="rounded-full bg-paper-3 px-3 py-1">
                    Steps {o.progress.done} of {o.progress.total}
                  </span>
                )}
              </div>
              <StageTrack steps={o.track} />
              {o.flags.stale && <p className="text-base font-medium text-thread">Please send an update</p>}

              <Link href={`/m/${token}/orders/${o.id}`} className={`${btnPrimary} w-full`}>
                Open order
              </Link>
            </li>
          );
        })}
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
