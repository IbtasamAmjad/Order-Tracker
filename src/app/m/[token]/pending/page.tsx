import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PendingWork } from "@/components/PendingWork";
import { PageTitle } from "@/components/ui";
import { PinForm } from "@/components/PinForm";
import { pendingWork } from "@/lib/item-search";
import { linkState, requireMaster } from "@/lib/master-session";

export const dynamic = "force-dynamic";

/** For a master: the steps waiting for him, across all his orders. */
export default async function MasterPending({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ e?: string }> }) {
  const { token } = await params;
  const { e } = await searchParams;
  const state = await linkState(token);
  if (state === "invalid") return <p className="text-xl">This link is not valid. Ask the office for a new link.</p>;
  if (state === "need-pin") return <PinForm token={token} error={e} />;
  const master = (await requireMaster(token))!;
  const steps = pendingWork(master.id);
  return (
    <div className="space-y-5">
      <Link href={`/m/${token}`} className="link inline-flex min-h-12 items-center gap-2 text-lg font-medium">
        <Icon name="arrow" className="h-4 w-4 rotate-180" /> Back
      </Link>
      <PageTitle icon="clock" large>My pending work</PageTitle>
      {steps.length === 0 ? <p className="text-xl">Nothing is waiting for you.</p> : <PendingWork token={token} steps={steps} all />}
    </div>
  );
}
