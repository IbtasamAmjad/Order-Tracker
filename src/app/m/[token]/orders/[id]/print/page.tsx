import Link from "next/link";
import { notFound } from "next/navigation";
import { PinForm } from "@/components/PinForm";
import { PrintButton } from "@/components/PrintButton";
import { PrintSheets } from "@/components/PrintSheets";
import { btnSecondary } from "@/components/ui";
import { linkState, requireMaster } from "@/lib/master-session";
import { masterOrder } from "@/lib/orders";
import { buildPrintData, hasSlips } from "@/lib/print";
import { Icon } from "@/components/Icon";

export default async function MasterPrint({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const state = await linkState(token);
  if (state === "invalid") return <p className="text-xl">This link is not valid. Ask the office for a new link.</p>;
  if (state === "need-pin") return <PinForm token={token} />;

  const master = (await requireMaster(token))!;
  const order = masterOrder(master.id, Number(id));
  const data = order ? buildPrintData(order.id) : null;
  if (!order || !data) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 print:hidden">
        <Link href={`/m/${token}/orders/${order.id}`} className={`${btnSecondary} gap-2`}>
          <Icon name="arrow" className="h-4 w-4 rotate-180" /> Back
        </Link>
        <PrintButton />
        <a href={`/api/m/${token}/orders/${order.id}/pdf`} className={btnSecondary}>
          Download PDF
        </a>
        {hasSlips(data) && (
          <a href={`/api/m/${token}/orders/${order.id}/pdf?only=slips`} className={btnSecondary}>
            Download tailor slips
          </a>
        )}
      </div>
      <PrintSheets data={data} imgUrl={(pid) => `/api/m/${token}/photos/${pid}`} />
    </div>
  );
}
