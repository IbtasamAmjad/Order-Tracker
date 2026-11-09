import Link from "next/link";
import { OrderEditor, type CategoryPicker } from "@/components/OrderEditor";
import { btnPrimary } from "@/components/ui";
import { listMasters } from "@/lib/masters";
import { listDesignNumbers } from "@/lib/orders";
import { pickerGroups, templateForItem } from "@/lib/templates";
import { saveOrderAction } from "../../actions";

export default async function NewOrder({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const masters = listMasters().filter((m) => m.active);

  if (masters.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="page-title">New customer</h1>
        <p className="text-lg">Add a master first.</p>
        <Link href="/admin/masters" className={btnPrimary}>
          Go to Masters
        </Link>
      </div>
    );
  }

  // the categories the customer can need, with their fields (the form opens them as the numbers go up)
  const groups = pickerGroups();
  const templates: CategoryPicker["templates"] = {};
  for (const g of groups) {
    for (const it of g.items) {
      const tpl = templateForItem(it.templateId);
      if (tpl) templates[it.templateId] = { name: tpl.snapshot.templateName, colour: tpl.snapshot.colour, fields: tpl.snapshot.fields };
    }
  }

  // an older link like ?q12=1&q15=2 still pre-fills the numbers
  const initial: Record<number, number> = {};
  for (const [k, v] of Object.entries(sp)) {
    const m = /^q(\d+)$/.exec(k);
    const qty = Math.min(Number(Array.isArray(v) ? v[0] : v) || 0, 10);
    if (m && qty > 0) initial[Number(m[1])] = qty;
  }

  return (
    <div className="space-y-4">
      <h1 className="page-title">New customer</h1>
      <OrderEditor action={saveOrderAction} masters={masters.map((m) => ({ id: m.id, name: m.name }))} designNumbers={listDesignNumbers().map((d) => ({ designNumber: d.designNumber, orderNumber: d.orderNumber, customerName: d.customerName }))} items={[]} submitLabel="Save customer" picker={{ groups, templates, initial }} />
    </div>
  );
}
