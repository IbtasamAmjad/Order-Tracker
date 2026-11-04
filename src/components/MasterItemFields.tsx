import type { ItemSnapshot } from "@/db/schema";
import { saveMasterFieldsAction } from "@/app/m/actions";
import { displayValue, isDisplayOnly, isTextEditable } from "@/lib/items";
import { FieldRow } from "./FieldRow";
import { PhotoUpload } from "./PhotoUpload";
import { btnPrimary } from "./ui";

/**
 * What the master sees for one category on a customer:
 * the details Admin filled (read-only), a measurements card, and a "your part" form for the
 * fields Admin allowed him to fill (comments, choices, pictures...).
 */
export function MasterItemFields({
  token,
  orderId,
  orderNumber,
  itemId,
  label,
  snapshot,
  values,
  canEdit,
}: {
  token: string;
  orderId: number;
  orderNumber: number;
  itemId: number;
  label: string;
  snapshot: ItemSnapshot;
  values: Record<string, string>;
  canEdit: boolean;
}) {
  const fields = snapshot.fields;
  const isReadOnly = (f: (typeof fields)[number]) => !(canEdit && f.masterCanEdit) && f.type !== "picture" && !isDisplayOnly(f);
  // everything the master reads, in the order Admin built the form (headings and notes included)
  const flow = fields
    .map((f) => ({ f, v: isReadOnly(f) ? displayValue(f, values[f.key]) : "" }))
    .filter((x) => isDisplayOnly(x.f) || x.v);
  const details = flow.filter((x) => x.f.type !== "number");
  const measures = flow.filter((x) => x.f.type === "number");
  const mine = canEdit ? fields.filter((f) => f.masterCanEdit) : [];
  const mineText = mine.filter(isTextEditable);
  const minePictures = mine.filter((f) => f.type === "picture");

  return (
    <>
      {details.map(({ f, v }) =>
        f.type === "heading" ? (
          <h3 key={f.key} className="border-b-2 border-base-300 pb-1 pt-2 text-xl font-medium">
            {f.label}
          </h3>
        ) : f.type === "note" ? (
          <p key={f.key} className="whitespace-pre-wrap text-base opacity-80">
            {f.label}
          </p>
        ) : (
          <p key={f.key} className="whitespace-pre-wrap text-lg">
            <b>{f.label}:</b> {v}
          </p>
        ),
      )}

      {measures.length > 0 && (
        <div className=" bg-base-200 p-3">
          <p className="mb-1 font-medium">
            Order #{orderNumber}, {label}, measurements
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-lg">
            {measures.map(({ f, v }) => (
              <div key={f.key} className="flex justify-between gap-2">
                <dt>{f.label}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {(mineText.length > 0 || minePictures.length > 0) && (
        <div className="space-y-4 rounded-2xl bg-accent-soft p-4">
          <p className="text-xl font-medium">Your part</p>

          {mineText.length > 0 && (
            <form action={saveMasterFieldsAction} className="space-y-4">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="itemId" value={itemId} />
              {mineText.map((f) => (
                <FieldRow key={f.key} f={f} name={`v:${f.key}`} value={values[f.key] ?? ""} />
              ))}
              <button className={`${btnPrimary} w-full`}>Save</button>
            </form>
          )}

          {minePictures.map((f) => (
            <div key={f.key} className="space-y-2">
              <p className="text-lg font-medium">{f.label}</p>
              <PhotoUpload
                endpoint={`/api/m/${token}/field-photos`}
                fields={{ itemId: String(itemId), fieldKey: f.key }}
                label="Take or choose a picture"
                camera
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
