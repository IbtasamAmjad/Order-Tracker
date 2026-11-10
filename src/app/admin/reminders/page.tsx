import Link from "next/link";
import { remindersList } from "@/lib/reminders";
import { EmptyState, btnPrimary, PageTitle } from "@/components/ui";

export default function Reminders() {
  const rows = remindersList();
  return (
    <div className="space-y-4">
      <PageTitle icon="reminders">Reminders</PageTitle>
      <p className="text-lg">
        Late, due within a week, or no update for a week. Tap the button to open WhatsApp, then press send.
      </p>
      {rows.length === 0 && <EmptyState title="Nothing to chase">Every order is on track.</EmptyState>}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.orderId} className="space-y-2 panel">
            <Link href={`/admin/orders/${r.orderId}`} className="link block text-xl font-medium">
              #{r.orderNumber} {r.customerName}
            </Link>
            <div className="text-lg">{r.masterName}</div>
            <ul className="list-disc pl-6 text-lg font-medium text-thread">
              {r.reasons.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <a href={r.link} target="_blank" rel="noreferrer" className={`${btnPrimary} w-full`}>
              Remind {r.masterName} on WhatsApp
            </a>
            {!r.hasNumber && <p className="text-base">No number saved for this master. Choose the chat yourself.</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
