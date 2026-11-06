import Link from "next/link";
import { Icon } from "@/components/Icon";
import { listMasters } from "@/lib/masters";
import { listAdminOrders } from "@/lib/orders";
import { remindersList } from "@/lib/reminders";
import { unseenShipmentCount } from "@/lib/shipping";
import { officeTodo, orderProgress } from "@/lib/stages";
import { Ruler, btnPrimary } from "@/components/ui";

function Figure({ href, label, value, note }: { href: string; label: string; value: number; note: string }) {
  return (
    <Link href={href} className="sign" data-live={value > 0 ? "" : undefined}>
      <span className="block text-base">{label}</span>
      <span className="figure my-2 block">{value}</span>
      <span className="flex items-center justify-between gap-2 text-base">
        <span>{note}</span>
        <Icon name="arrow" className="h-4 w-4 shrink-0" />
      </span>
    </Link>
  );
}

export default function Home() {
  const rows = listAdminOrders({ view: "active" });
  const overdue = rows.filter((r) => r.flags?.overdue).length;
  const shipments = unseenShipmentCount();
  const reminders = remindersList();
  const waiting = officeTodo();
  const masters = listMasters()
    .filter((m) => m.active)
    .map((m) => {
      const mine = rows.filter((r) => r.masterIds.includes(m.id));
      const steps = mine.map((r) => orderProgress(r.id));
      return {
        id: m.id,
        name: m.name,
        customers: mine.length,
        done: steps.reduce((n, s) => n + s.done, 0),
        total: steps.reduce((n, s) => n + s.total, 0),
      };
    });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">
            {rows.length === 0 ? "No customers yet." : `${rows.length} customer${rows.length === 1 ? "" : "s"} in progress.`}
          </h1>
          <p className="page-sub mt-1.5">
            {rows.length === 0
              ? "Add your first customer to start the order book."
              : overdue === 0
                ? "Nothing is overdue."
                : `${overdue} ${overdue === 1 ? "is" : "are"} past the due date.`}
          </p>
        </div>
        <Link href="/admin/orders/new" className={btnPrimary}>
          <Icon name="plus" className="h-4 w-4" /> New customer
        </Link>
      </header>

      <div className="ledger">
        <Figure href="/admin/shipments" label="New shipments" value={shipments} note={shipments === 0 ? "None new" : "Sent with the bill"} />
        <Figure href="/admin/reminders" label="To chase" value={reminders.length} note={reminders.length === 0 ? "All caught up" : "Late or quiet orders"} />
      </div>

      {waiting.length > 0 && (
        <section className="panel space-y-2">
          <h2 className="text-xl font-medium">Waiting for you</h2>
          <p className="page-sub">These steps cannot move on until you fill something in.</p>
          <ul className="divide-y divide-rule">
            {waiting.map((w) => (
              <li key={`${w.orderId}-${w.itemLabel}-${w.stageLabel}`}>
                <Link href={`/admin/orders/${w.orderId}`} className="-mx-2 block px-2 py-3 hover:bg-paper-3">
                  <span className="block text-base font-medium">
                    #{w.orderNumber} {w.customerName}
                  </span>
                  <span className="block text-base text-accent-deep">
                    {w.itemLabel}, {w.stageLabel}: fill in {w.fields.join(", ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="panel space-y-5">
          <h2 className="text-xl font-medium">Masters</h2>
          {masters.length === 0 && <p className="text-base text-muted">No masters yet.</p>}
          {masters.map((m) => (
            <div key={m.id} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                <Link href={`/admin/customers?master=${m.id}`} className="link inline-flex min-h-11 items-center text-lg font-medium">
                  {m.name}
                </Link>
                <span className="text-base text-muted">
                  {m.customers} customer{m.customers === 1 ? "" : "s"}
                  {m.total > 0 && `, steps ${m.done}/${m.total}`}
                </span>
              </div>
              <Ruler value={m.done} total={m.total} label={`${m.name}: ${m.done} of ${m.total} steps done`} />
            </div>
          ))}
        </section>

        <section className="panel space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
            <h2 className="text-xl font-medium">Needs attention</h2>
            <Link href="/admin/reminders" className="link text-base font-medium">
              See all
            </Link>
          </div>
          {reminders.length === 0 && <p className="text-base text-muted">Nothing to chase.</p>}
          <ul className="divide-y divide-rule">
            {reminders.slice(0, 5).map((r) => (
              <li key={r.orderId}>
                <Link href={`/admin/orders/${r.orderId}`} className="-mx-2 block px-2 py-3 hover:bg-paper-2">
                  <span className="block text-base font-medium">
                    #{r.orderNumber} {r.customerName}
                  </span>
                  <span className="block text-base font-medium text-thread">{r.reasons.join(", ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
