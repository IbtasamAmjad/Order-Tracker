import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { PrintSheets } from "@/components/PrintSheets";
import { btnSecondary } from "@/components/ui";
import { buildPrintData, hasSlips } from "@/lib/print";
import { Icon } from "@/components/Icon";

export default async function AdminPrint({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const data = buildPrintData(id);
  if (!data) notFound();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 print:hidden">
        <Link href={`/admin/orders/${id}`} className={`${btnSecondary} gap-2`}>
          <Icon name="arrow" className="h-4 w-4 rotate-180" /> Back
        </Link>
        <PrintButton />
        <a href={`/api/admin/orders/${id}/pdf`} className={btnSecondary}>
          Download PDF
        </a>
        {hasSlips(data) && (
          <a href={`/api/admin/orders/${id}/pdf?only=slips`} className={btnSecondary}>
            Download tailor slips
          </a>
        )}
      </div>
      <PrintSheets data={data} imgUrl={(pid) => `/api/admin/photos/${pid}`} />
    </div>
  );
}
