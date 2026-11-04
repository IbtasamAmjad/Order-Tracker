import Link from "next/link";
import { OrderEditor } from "@/components/OrderEditor";
import { btnPrimary, btnSecondary, input } from "@/components/ui";
import { itemLabel } from "@/lib/items";
import { listMasters } from "@/lib/masters";
import { pickerGroups, templateForItem } from "@/lib/templates";
import type { EditorItem } from "@/lib/editor-state";
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

  // quantities chosen in step 1: ?q12=1&q15=2
  const picked: { templateId: number; qty: number }[] = [];
  for (const [k, v] of Object.entries(sp)) {
    const m = /^q(\d+)$/.exec(k);
    const qty = Math.min(Number(Array.isArray(v) ? v[0] : v) || 0, 10);
    if (m && qty > 0) picked.push({ templateId: Number(m[1]), qty });
  }

  if (picked.length === 0 && !sp.go) {
    const groups = pickerGroups();
    return (
      <form className="space-y-5">
        <h1 className="page-title">New customer: what do they need?</h1>
        <p className="text-lg">Put a number next to each category this customer needs. Leave the others at 0.</p>
        {groups.length === 0 && (
          <p className="text-lg">
            No categories yet.{" "}
            <Link href="/admin/templates" className="link font-medium">
              Set them up
            </Link>
            , or continue without categories.
          </p>
        )}
        {groups.map((g) => (
          <div key={g.id} className="space-y-2">
            <h2 className="text-xl font-medium">{g.name}</h2>
            {g.items.map((it) => (
              <label key={it.templateId} className="flex items-center gap-3 panel">
                <span className="inline-block h-5 w-5 shrink-0 rounded-full" style={{ background: it.colour }} />
                <span className="flex-1 text-xl">{it.name}</span>
                <input
                  type="number"
                  name={`q${it.templateId}`}
                  min={0}
                  max={10}
                  defaultValue={0}
                  inputMode="numeric"
                  className={`${input} w-24 text-center`}
                />
              </label>
            ))}
          </div>
        ))}
        <button className={`${btnPrimary} w-full`}>Next</button>
        <button name="go" value="1" className={`${btnSecondary} w-full`}>
          Continue without categories
        </button>
      </form>
    );
  }

  const items: EditorItem[] = [];
  let n = 0;
  for (const { templateId, qty } of picked) {
    const tpl = templateForItem(templateId);
    if (!tpl) continue;
    for (let i = 0; i < qty; i++) {
      items.push({
        key: `n${n++}`,
        templateId: tpl.id,
        label: itemLabel(tpl.snapshot.templateName, i, qty),
        colour: tpl.snapshot.colour,
        fields: tpl.snapshot.fields,
        values: {},
      });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="page-title">New customer</h1>
      <OrderEditor action={saveOrderAction} masters={masters} items={items} submitLabel="Save customer" />
    </div>
  );
}
