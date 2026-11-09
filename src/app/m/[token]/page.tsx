import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PinForm } from "@/components/PinForm";
import { StageTrack } from "@/components/StageTrack";
import { PositionTile, btnPrimary, card, chipAttention, fmtDay } from "@/components/ui";
import { BAND_CLASS, BAND_LABEL } from "@/lib/colour";
import { linkState, requireMaster } from "@/lib/master-session";
import { masterDashboard } from "@/lib/orders";
import { pendingWork } from "@/lib/item-search";

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
  if (state === "invalid") return <p className="text-xl">This link is not valid. Ask the office for a new link.</p>;
  if (state === "need-pin") return <PinForm token={token} error={e} />;

  const master = (await requireMaster(token))!;
  const { active } = masterDashboard(master.id);
  const pending = pendingWork(master.id);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title text-4xl">Hello {master.name}</h1>
        <p className="text-lg">{active.length === 0 ? "No orders right now." : "Open an order to work on it. Any order can be done first."}</p>
      </header>

      <div className="grid grid-cols-1 gap-2 min-[330px]:grid-cols-3 md:max-w-xl md:gap-3">
        <Link href={`/m/${token}/items`} className="flex min-h-24 flex-col justify-between gap-2 rounded-2xl border border-rule-2 bg-paper-2 p-3 text-lg font-medium leading-tight hover:bg-paper-3">
          <Icon name="box" className="h-6 w-6 text-muted" />
          Items
        </Link>
        <Link href={`/m/${token}/pending`} className="flex min-h-24 flex-col justify-between gap-2 rounded-2xl border border-rule-2 bg-paper-2 p-3 text-lg font-medium leading-tight hover:bg-paper-3">
          <span className="flex items-center justify-between">
            <Icon name="clock" className="h-6 w-6 text-muted" />
            {pending.length > 0 && <span className="rounded-full bg-accent px-2.5 py-0.5 text-sm text-white">{pending.length}</span>}
          </span>
          My pending work
        </Link>
        <Link href={`/m/${token}/finished`} className="flex min-h-24 flex-col justify-between gap-2 rounded-2xl border border-rule-2 bg-paper-2 p-3 text-lg font-medium leading-tight hover:bg-paper-3">
          <Icon name="finished" className="h-6 w-6 text-muted" />
          Finished
        </Link>
      </div>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  {o.designNumber && <p className="text-base font-medium text-accent-deep">Design: {o.designNumber}</p>}
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
    </div>
  );
}
