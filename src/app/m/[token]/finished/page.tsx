import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PinForm } from "@/components/PinForm";
import { card } from "@/components/ui";
import { linkState, requireMaster } from "@/lib/master-session";
import { masterDashboard } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** For a master: his finished orders (completed or cancelled). */
export default async function MasterFinished({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ e?: string }> }) {
  const { token } = await params;
  const { e } = await searchParams;
  const state = await linkState(token);
  if (state === "invalid") return <p className="text-xl">This link is not valid. Ask the office for a new link.</p>;
  if (state === "need-pin") return <PinForm token={token} error={e} />;
  const master = (await requireMaster(token))!;
  const { closed } = masterDashboard(master.id);
  return (
    <div className="space-y-5">
      <Link href={`/m/${token}`} className="link inline-flex min-h-12 items-center gap-2 text-lg font-medium">
        <Icon name="arrow" className="h-4 w-4 rotate-180" /> Back
      </Link>
      <h1 className="page-title text-4xl">Finished</h1>
      {closed.length === 0 ? (
        <p className="text-xl">No finished orders yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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
      )}
    </div>
  );
}
