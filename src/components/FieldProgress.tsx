import type { FieldDef } from "@/db/schema";
import { fieldProgress, type ItemValues } from "@/lib/items";
import { Ruler } from "./ui";

/** A bar and a line of words: how many fields of one item are filled in, like "5 of 12 fields filled". */
export function FieldProgress({ fields, values, pictureKeys }: { fields: FieldDef[]; values: ItemValues; pictureKeys?: Iterable<string> }) {
  const { filled, total } = fieldProgress(fields, values, pictureKeys);
  if (total === 0) return null;
  const text = `${filled} of ${total} ${total === 1 ? "field" : "fields"} filled`;
  return (
    <div className="space-y-1">
      <p className="text-base font-medium">{text}{filled === total ? " ✓" : ""}</p>
      <Ruler value={filled} total={total} label={text} />
    </div>
  );
}
