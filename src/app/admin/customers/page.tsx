import Link from "next/link";
import { listAdminOrders } from "@/lib/orders";
import { listMasters } from "@/lib/masters";
import { syncActiveItems } from "@/lib/item-sync";
import { BAND_CLASS, BAND_LABEL } from "@/lib/colour";
import { EmptyState, PageHeader, Ruler, btnPrimary, btnSecondary, card, fmtDate, fmtDay, input } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { WhatsAppNotice } from "@/components/WhatsAppNotice";
import { orderNotices, type OrderNoticeKind } from "@/lib/notify";
import { moveOrderAction } from "../actions";

export default async function Customers({
  searchParams,
}: {
  searchParams: Promise<{ master?: string; notify?: string; show?: string; sort?: string }>;
}) {
  const { master, notify, show, sort } = await searchParams;
  const byDue = sort === "due"; // the chip "Sort by due date": earliest Karigar due date first
  const [kind, nid] = (notify ?? "").split(":");
  const notices = kind && nid ? orderNotices(kind as OrderNoticeKind, Number(nid)) : [];
  const masterId = Number(master) || undefined;
  syncActiveItems(); // keeps customers in progress up to date with their items
  const everyone = listAdminOrders({ masterId, view: "active" });
  const masters = listMasters();

  // the filter chips: all live orders, overdue ones, and one chip for each work stage the orders are at
  const overdue = everyone.filter((r) => r.flags?.overdue);
  const stageCount = new Map<string, number>();
  for (const r of everyone) if (r.stage) stageCount.set(r.stage, (stageCount.get(r.stage) ?? 0) + 1);
  const LAST = ["Ready to ship", "No steps set up"];
  const stages = [...stageCount.entries()].sort((x, y) => LAST.indexOf(x[0]) - LAST.indexOf(y[0]));
  // the deadline tags, counted the same way the tag on each card is decided
  const bandCount = { red: 0, green: 0, blue: 0 };
  for (const r of everyone) if (r.band) bandCount[r.band]++;
  const picked =
    show === "overdue"
      ? overdue
      : show?.startsWith("band:")
        ? everyone.filter((r) => r.band === show.slice(5))
        : show?.startsWith("stage:")
          ? everyone.filter((r) => r.stage === show.slice(6))
          : everyone;
  // by due date: the earliest first; orders with the same date keep their priority order
  const rank = new Map(everyone.map((r, i) => [r.id, i]));
  const rows = byDue ? [...picked].sort((a, b) => a.karigarDueDate.localeCompare(b.karigarDueDate) || (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)) : picked;
  const href = (to?: string, due: boolean = byDue) => {
    const q = new URLSearchParams();
    if (masterId) q.set("master", String(masterId));
    if (to) q.set("show", to);
    if (due) q.set("sort", "due");
    return `/admin/customers${q.size ? `?${q}` : ""}`;
  };
  const back = href(show);
  const chip = (active: boolean, tone: "plain" | "red" | "green" | "blue" = "plain") =>
    `inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-base font-medium transition-colors ${
      active
        ? { plain: "border-ink bg-ink text-white", red: "border-bad bg-bad text-white", green: "border-ok bg-ok text-white", blue: "border-cloth bg-cloth text-white" }[tone]
        : {
            plain: "border-rule-2 bg-paper-2 text-ink hover:bg-paper-3",
            red: "border-bad/40 bg-bad-soft text-bad hover:bg-bad/10",
            green: "border-ok/40 bg-ok-soft text-ok hover:bg-ok/10",
            blue: "border-cloth/40 bg-cool-soft text-cloth hover:bg-cloth/10",
          }[tone]
    }`;
  const count = (n: number, active: boolean) => (
    <span className={`rounded-full px-2 text-sm ${active ? "bg-white/25" : "bg-paper-3 text-ink"}`}>{n}</span>
  );

  return (
    <div className="space-y-4">
      <WhatsAppNotice notices={notices} />
      <PageHeader icon="customers" title="Customers" sub={byDue ? "By due date, the earliest first." : "In the order the masters should work them."}>
        <Link href="/admin/orders/new" className={btnPrimary}>
          <Icon name="plus" className="h-4 w-4" /> New customer
        </Link>
      </PageHeader>
      <nav aria-label="Filter customers" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <Link href={href()} className={chip(!show)} aria-current={!show ? "page" : undefined}>
          All live orders {count(everyone.length, !show)}
        </Link>
        <Link href={href("overdue")} className={chip(show === "overdue", "red")} aria-current={show === "overdue" ? "page" : undefined}>
          <span aria-hidden className="h-2 w-2 rounded-full bg-current" />
          Overdue orders {count(overdue.length, show === "overdue")}
        </Link>
        {(["red", "green", "blue"] as const).map((band) => {
          const on = show === `band:${band}`;
          return (
            <Link key={band} href={href(`band:${band}`)} className={chip(on, band)} aria-current={on ? "page" : undefined}>
              {BAND_LABEL[band].text} {count(bandCount[band], on)}
            </Link>
          );
        })}
        {stages.map(([label, n]) => {
          const on = show === `stage:${label}`;
          return (
            <Link key={label} href={href(`stage:${label}`)} className={chip(on)} aria-current={on ? "page" : undefined}>
              {label} ({n})
            </Link>
          );
        })}
        <Link href={href(show, !byDue)} className={chip(byDue)} aria-pressed={byDue} title={byDue ? "Back to the priority order" : "Show the earliest due date first"}>
          <Icon name={byDue ? "check" : "clock"} className="h-4 w-4" /> {byDue ? "Sorted by due date" : "Sort by due date"}
        </Link>
      </nav>

      {byDue && rows.length > 0 && (
        <p role="status" className="flex flex-wrap items-center gap-2 rounded-2xl border border-ink/15 bg-paper-2 px-4 py-2.5 text-base">
          <Icon name="clock" className="h-4 w-4 shrink-0 text-muted" />
          <span>
            Earliest Karigar due date first: <b className="font-medium">{fmtDay(rows[0].karigarDueDate)}</b>
            {rows.length > 1 && (
              <>
                {" "}to <b className="font-medium">{fmtDay(rows[rows.length - 1].karigarDueDate)}</b>
              </>
            )}
            .
          </span>
          <Link href={href(show, false)} className="link ml-auto font-medium">
            Back to priority order
          </Link>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <form className="flex w-full flex-wrap gap-2">
          {show && <input type="hidden" name="show" value={show} />}
          {byDue && <input type="hidden" name="sort" value="due" />}
          <select name="master" defaultValue={masterId ?? ""} className={`${input} min-w-0 flex-1 basis-40`}>
            <option value="">All masters</option>
            {masters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button className={btnSecondary}>Filter</button>
        </form>
      </div>

      {rows.length === 0 &&
        (show || masterId ? (
          <EmptyState title="No customers here">Nothing matches. Choose All live orders to see everyone.</EmptyState>
        ) : (
          <EmptyState title="No customers yet">Press New customer to start the order book.</EmptyState>
        ))}

      <ul className="space-y-4">
        {rows.map((o, i) => {
          const late = !!o.flags?.overdue;
          const status = late ? `Overdue by ${o.flags!.daysOverdue} day${o.flags!.daysOverdue === 1 ? "" : "s"}` : BAND_LABEL[o.band!].text;
          const tone = late || o.band === "red" ? "red" : o.band === "green" ? "green" : "blue";
          const pill = { red: "border-bad/30 bg-bad-soft text-bad", green: "border-ok/30 bg-ok-soft text-ok", blue: "border-cloth/30 bg-cool-soft text-cloth" }[tone];
          const dot = { red: "bg-bad", green: "bg-ok", blue: "bg-cloth" }[tone];
          const pct = (done: number, total: number) => (total === 0 ? 0 : Math.round((done / total) * 100));
          // an arrow swaps the order with the one next to it in this list, whoever its master is; the first and last have only one arrow
          const at = rows.findIndex((r) => r.id === o.id);
          const next = { up: rows[at - 1], down: rows[at + 1] };
          const canMove = { up: !byDue && !!next.up, down: !byDue && !!next.down }; // the arrows set the priority order, so they rest while the list is sorted by date
          const tile = "rounded-2xl border px-4 py-2";
          const tileLabel = "text-xs font-medium uppercase tracking-wide";
          return (
            <li key={o.id} className={`${card} relative space-y-4 border-l-4 transition-shadow hover:shadow-[0_4px_14px_-8px_rgb(27_26_75/0.22)] ${late ? "border-l-thread !border-bad/40 !bg-bad-soft" : BAND_CLASS[o.band!]}`}>
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                <span aria-label={`Number ${i + 1} in the list`} className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink text-xl font-medium text-white">
                  {i + 1}
                  <span aria-hidden className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-paper-2 ${dot} ${tone === "red" ? "shadow-[0_0_8px_2px_rgb(200_30_30/0.6)] motion-safe:animate-pulse" : ""}`} />
                </span>
                {/* the link stretches over the whole card (the ::after), so a click anywhere opens the customer; the arrows sit above it */}
                <Link href={`/admin/orders/${o.id}`} className="group min-w-0 flex-1 basis-48 after:absolute after:inset-0 after:content-['']" aria-label={`Open customer ${o.customerName}`}>
                  <p className="flex flex-wrap items-center gap-2 text-xl font-medium leading-snug">
                    <span className="rounded-lg bg-accent-soft px-2 py-0.5 text-base text-accent-deep">#{o.orderNumber}</span>
                    <span className="break-words group-hover:underline">{o.customerName}</span>
                    {o.designNumber && <span className="rounded-lg border border-rule bg-paper-3/60 px-2 py-0.5 text-sm font-medium text-ink-2">{o.designNumber}</span>}
                    {o.linkedDesignNumber && <span className="rounded-lg border border-accent/20 bg-accent-soft/60 px-2 py-0.5 text-sm text-accent-deep">Linked to {o.linkedDesignNumber}</span>}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                    {o.itemLabels.length > 0 ? (
                      o.itemLabels.map((l, n) => (
                        <span key={`${l}-${n}`} className="rounded-full bg-paper-3 px-3 py-0.5 text-ink-2">
                          {l}
                        </span>
                      ))
                    ) : (
                      <span>No items yet</span>
                    )}
                  </p>
                </Link>
                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${pill}`}>
                    <Icon name="clock" className="h-4 w-4" />
                    {status}
                  </span>
                  <div className="relative z-10 inline-flex divide-x divide-rule-2 overflow-hidden rounded-xl border border-rule-2 bg-paper-2">
                    {(["up", "down"] as const).map((dir) => (
                      <form key={dir} action={moveOrderAction}>
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="dir" value={dir} />
                        <input type="hidden" name="with" value={next[dir]?.id ?? ""} />
                        <input type="hidden" name="back" value={back} />
                        <button
                          disabled={!canMove[dir]}
                          title={canMove[dir] ? undefined : byDue ? "Turn off Sort by due date to move orders" : dir === "up" ? "This is the first order" : "This is the last order"}
                          className="grid h-9 w-10 place-items-center text-ink-2 hover:bg-paper-3 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                          aria-label={`Move order ${o.orderNumber} ${dir}`}
                        >
                          <Icon name={dir} className="h-4 w-4" />
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-stretch gap-3 border-t border-rule pt-4">
                <div className={`${tile} flex items-center gap-3 border-accent/20 bg-accent-soft/60`}>
                  <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-sm font-medium text-accent-ink">
                    {o.masterName.trim().charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className={`${tileLabel} text-accent-deep`}>Master</p>
                    <p className="font-medium">{o.masterName}</p>
                  </div>
                </div>
                <div className={`${tile} flex items-center gap-3 border-rule bg-paper-3/60`}>
                  <Icon name="date" className="h-5 w-5 shrink-0 text-muted" />
                  <div>
                    <p className={`${tileLabel} text-muted`}>My due</p>
                    <p className="font-medium">{fmtDay(o.myDueDate)}</p>
                  </div>
                </div>
                <div className={`${tile} flex items-center gap-3 ${late ? "border-bad/50 bg-white" : "border-rule bg-paper-3/60"} ${byDue ? "ring-2 ring-ink/70" : ""}`}>
                  <span aria-hidden className="relative flex h-2.5 w-2.5 shrink-0">
                    {late && <span className="absolute inline-flex h-full w-full rounded-full bg-bad opacity-70 motion-safe:animate-ping" />}
                    <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${late ? "bg-bad shadow-[0_0_8px_2px_rgb(200_30_30/0.6)]" : "bg-muted"}`} />
                  </span>
                  <div>
                    <p className={`${tileLabel} ${late ? "text-bad" : "text-muted"}`}>Karigar due</p>
                    <p className={`font-medium ${late ? "text-bad" : ""}`}>{fmtDay(o.karigarDueDate)}</p>
                  </div>
                </div>

                <div className="ml-auto flex flex-wrap gap-3">
                  {o.progress.total > 0 && (
                    <div className={`${tile} w-44 border-rule bg-paper-2`}>
                      <p className="flex items-baseline justify-between text-sm text-muted">
                        Steps <b className="font-medium text-ink">{o.progress.done} of {o.progress.total}</b>
                      </p>
                      <Ruler value={o.progress.done} total={o.progress.total} label={`Steps ${pct(o.progress.done, o.progress.total)} percent`} />
                    </div>
                  )}
                  {o.fields.total > 0 && (
                    <div className={`${tile} w-44 border-rule bg-paper-2`}>
                      <p className="flex items-baseline justify-between text-sm text-muted">
                        Fields <b className="font-medium text-accent-deep">{o.fields.filled} of {o.fields.total}</b>
                      </p>
                      <Ruler value={o.fields.filled} total={o.fields.total} label={`Fields ${pct(o.fields.filled, o.fields.total)} percent`} />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-rule pt-3 text-sm">
                {o.flags?.stale && <p className="font-medium text-thread">No update for {o.flags.idleDays} days</p>}
                {o.masterEditedAt && (
                  <p className="flex items-center gap-2 font-medium text-secondary">
                    <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
                    Master added info {fmtDate(o.masterEditedAt)}
                  </p>
                )}
                <p className="flex items-center gap-2 text-muted">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-rule-2" />
                  {o.masterSeenAt ? `Master opened it ${fmtDate(o.masterSeenAt)}` : "Master has not opened it yet"}
                </p>
                <p className={`flex items-center gap-2 ${o.confirmedAt ? "text-ok" : "text-muted"}`}>
                  <span aria-hidden className={`h-2 w-2 rounded-full ${o.confirmedAt ? "bg-ok" : "bg-rule-2"}`} />
                  {o.confirmedAt ? `Confirmed ${fmtDate(o.confirmedAt)}` : "Not confirmed yet"}
                </p>
                <span aria-hidden className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-ink text-white">
                  <Icon name="arrow" className="h-4 w-4" />
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
