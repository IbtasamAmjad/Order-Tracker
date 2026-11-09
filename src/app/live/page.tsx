import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { isAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { BAND_LABEL } from "@/lib/colour";
import { Icon } from "@/components/Icon";
import { fmtDay } from "@/components/ui";
import { listAdminOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Custom Order Manager - Live" };

type Row = ReturnType<typeof listAdminOrders>[number];

const TONE = {
  red: { dot: "bg-thread", pill: "bg-bad-soft text-bad border-thread/30" },
  green: { dot: "bg-leaf", pill: "bg-ok-soft text-ok border-leaf/30" },
  blue: { dot: "bg-cloth", pill: "bg-cool-soft text-cloth border-cloth/30" },
} as const;

/** How long a column or the list shows before saying "+N more": a TV shows what fits. */
const COLUMN_LIMIT = 6;
const LIST_LIMIT = 14;

function late(r: Row) {
  return !!r.flags?.overdue;
}

/** The tag of an order: "Overdue by 2 days", or Urgent / Coming due / On Time (decided by the deadline only). */
function tag(r: Row) {
  return late(r) ? `Overdue by ${r.flags!.daysOverdue} day${r.flags!.daysOverdue === 1 ? "" : "s"}` : BAND_LABEL[r.band!].text;
}

/**
 * The live board, made for an office TV (and fine on an iPad or a computer): the live orders by work stage, the ones
 * to watch, and every pending order with its progress. It refreshes itself every 5 seconds. Admin sign-in is needed once;
 * the sign-in stays for 30 days, so the TV can stay on.
 */
export default async function Live() {
  if (!(await isAdmin())) redirect("/admin/login?next=/live");

  const rows = listAdminOrders({ view: "active" });
  const overdue = rows.filter(late);
  const urgent = rows.filter((r) => r.band === "red");
  const ready = rows.filter((r) => r.stage === "Ready to ship");

  // the columns: each work stage with the orders that are at it (the last two are not stages of work)
  const LAST = ["Ready to ship", "No steps set up"];
  const byStage = new Map<string, Row[]>();
  for (const r of rows) if (r.stage) byStage.set(r.stage, [...(byStage.get(r.stage) ?? []), r]);
  const columns = [...byStage.entries()].sort((a, b) => LAST.indexOf(a[0]) - LAST.indexOf(b[0]));

  // the list: nearest deadline first
  const byDeadline = [...rows].sort((a, b) => a.karigarDueDate.localeCompare(b.karigarDueDate));

  const tiles = [
    { label: "Live orders", value: rows.length, accent: "text-ink" },
    { label: "Overdue", value: overdue.length, accent: overdue.length ? "text-thread" : "text-ink" },
    { label: "Urgent", value: urgent.length, accent: urgent.length ? "text-thread" : "text-ink" },
    { label: "Ready to ship", value: ready.length, accent: "text-ok" },
  ];

  return (
    <main className="min-h-screen px-4 py-5 text-ink sm:px-8 sm:py-8">
      <div className="mx-auto max-w-[110rem] space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-medium tracking-tight sm:text-4xl">Custom Order Manager</h1>
          <div className="flex flex-wrap items-center gap-4">
            <AutoRefresh seconds={5} />
            <Link href="/admin" className="btn h-auto min-h-11 gap-2 !border-ink !bg-ink px-5 py-2 text-base !text-white">
              <Icon name="home" className="h-5 w-5" /> Home
            </Link>
          </div>
        </header>

        <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-3xl border border-rule-2 bg-paper-2 shadow-sm px-6 py-5">
              <p className="text-lg text-muted sm:text-xl">{t.label}</p>
              <p className={`font-display text-6xl font-medium leading-none sm:text-8xl ${t.accent}`}>{t.value}</p>
            </div>
          ))}
        </section>

        <section aria-label="Production" className="space-y-3">
          <h2 className="text-2xl font-medium sm:text-3xl">Production progress</h2>
          {columns.length === 0 ? (
            <p className="rounded-3xl border border-rule-2 bg-paper-2 shadow-sm px-6 py-10 text-center text-xl text-muted">No live orders right now.</p>
          ) : (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(17rem,100%),1fr))]">
              {columns.map(([stage, list]) => (
                <div key={stage} className="rounded-3xl border border-rule-2 bg-paper-2 shadow-sm p-4">
                  <div className="mb-3 flex items-center justify-between gap-2 border-b border-rule pb-3">
                    <h3 className="text-xl font-medium sm:text-2xl">{stage}</h3>
                    <span className="rounded-full bg-paper-3 px-3 py-0.5 text-xl font-medium">{list.length}</span>
                  </div>
                  <ul className="space-y-2">
                    {list.slice(0, COLUMN_LIMIT).map((r) => (
                      <li key={r.id} className="flex items-start gap-3 rounded-2xl bg-paper-3/70 px-3 py-2.5">
                        <span aria-hidden className={`mt-2 h-3 w-3 shrink-0 rounded-full ${TONE[late(r) ? "red" : r.band!].dot}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-lg font-medium sm:text-xl">
                            #{r.orderNumber} {r.customerName}
                          </span>
                          <span className="block truncate text-base text-muted">
                            {r.designNumber ? `${r.designNumber} · ` : ""}
                            {fmtDay(r.karigarDueDate)}
                          </span>
                        </span>
                      </li>
                    ))}
                    {list.length > COLUMN_LIMIT && <li className="px-3 text-lg text-muted">+{list.length - COLUMN_LIMIT} more</li>}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Pending orders" className="space-y-3">
          <h2 className="text-2xl font-medium sm:text-3xl">Pending orders</h2>
          <ul className="space-y-2">
            {byDeadline.slice(0, LIST_LIMIT).map((r) => {
              const tone = TONE[late(r) ? "red" : r.band!];
              const pct = r.progress.total === 0 ? 0 : Math.round((r.progress.done / r.progress.total) * 100);
              return (
                <li key={r.id} className="grid items-center gap-x-4 gap-y-2 rounded-3xl border border-rule-2 bg-paper-2 shadow-sm px-5 py-4 grid-cols-2 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.4fr)]">
                  <div className="col-span-2 min-w-0 lg:col-span-1">
                    <p className="truncate text-xl font-medium sm:text-2xl">
                      <span className="mr-2 rounded-lg bg-paper-3 px-2 py-0.5 text-lg">#{r.orderNumber}</span>
                      {r.customerName}
                    </p>
                    <p className="truncate text-base text-muted sm:text-lg">
                      {r.designNumber ? `${r.designNumber} · ` : ""}
                      {r.itemLabels.length > 0 ? r.itemLabels.join(", ") : "No items yet"}
                    </p>
                  </div>
                  <p className="text-lg sm:text-xl">
                    <span className="block text-base text-muted">Master</span>
                    {r.masterName}
                  </p>
                  <p className="text-lg sm:text-xl">
                    <span className="block text-base text-muted">Karigar due</span>
                    {fmtDay(r.karigarDueDate)}
                  </p>
                  <div className="col-span-2 space-y-1.5 lg:col-span-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <span className={`whitespace-nowrap rounded-full border px-3 py-0.5 text-base font-medium ${tone.pill}`}>{tag(r)}</span>
                      <span className="text-base text-muted">{r.stage ?? "Done"}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-paper-3" role="img" aria-label={`Steps ${pct} percent`}>
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
            {byDeadline.length > LIST_LIMIT && <li className="px-2 text-lg text-muted">+{byDeadline.length - LIST_LIMIT} more</li>}
            {byDeadline.length === 0 && <li className="rounded-3xl border border-rule-2 bg-paper-2 shadow-sm px-6 py-10 text-center text-xl text-muted">Nothing pending.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}
