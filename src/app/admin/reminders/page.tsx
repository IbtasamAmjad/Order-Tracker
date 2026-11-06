import Link from "next/link";
import { remindersList } from "@/lib/reminders";
import { EmptyState } from "@/components/ui";

export default function Reminders() {
  const rows = remindersList();
  return (
    <div className="space-y-4">
      <h1 className="page-title">Reminders</h1>
      <p className="text-lg">
        Orders that are late, due within a week, or have had no update for a week.
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
          </li>
        ))}
      </ul>
    </div>
  );
}
