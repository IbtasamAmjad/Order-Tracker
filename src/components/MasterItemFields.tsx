import type { FieldDef, ItemSnapshot } from "@/db/schema";
import { saveMasterFieldsAction } from "@/app/m/actions";
import { displayValue, isDisplayOnly, isTextEditable } from "@/lib/items";
import { referencePhotos } from "@/lib/stages";
import { FieldPictures } from "./DesignPictures";
import { FieldRow } from "./FieldRow";
import { PhotoUpload } from "./PhotoUpload";
import { btnPrimary } from "./ui";

/**
 * What the master sees for one item of an order, made to be understood at a glance:
 * the details as short rows (name small, answer big), the measurements as big number tiles,
 * and a "your part" form for the fields Admin allowed him to fill.
 */
export function MasterItemFields({
  token,
  orderId,
  itemId,
  snapshot,
  values,
  canEdit,
}: {
  token: string;
  orderId: number;
  itemId: number;
  snapshot: ItemSnapshot;
  values: Record<string, string>;
  canEdit: boolean;
}) {
  const fields = snapshot.fields;
  const isReadOnly = (f: (typeof fields)[number]) => !(canEdit && f.masterCanEdit) && f.type !== "picture" && !isDisplayOnly(f);
  // everything the master reads, in the order Admin built the form (headings and notes included)
  // An empty field is left out, so the master never sees an empty box he cannot use. Two exceptions: a field the office
  // marked "warn if empty" stays, as an empty box under its name, so it is clear something was not given; and a field
  // that has pictures stays.
  const withPictures = new Set(referencePhotos(itemId).map((r) => r.fieldKey ?? ""));
  const flow = fields
    .map((f) => ({ f, v: isReadOnly(f) ? displayValue(f, values[f.key]) : "" }))
    .filter((x) => isDisplayOnly(x.f) || x.v || (isReadOnly(x.f) && (x.f.required || withPictures.has(x.f.key))));
  const mine = canEdit ? fields.filter((f) => f.masterCanEdit) : [];
  const mineText = mine.filter(isTextEditable);
  const minePictures = mine.filter((f) => f.type === "picture");

  // the form in sections: a bold heading starts a new one
  type Row = { f: FieldDef; v: string };
  const sections: { title: string | null; rows: Row[]; notes: string[] }[] = [{ title: null, rows: [], notes: [] }];
  for (const { f, v } of flow) {
    if (f.type === "heading") sections.push({ title: f.label, rows: [], notes: [] });
    else if (f.type === "note") sections[sections.length - 1].notes.push(f.label);
    else sections[sections.length - 1].rows.push({ f, v });
  }

  return (
    <>
      {sections
        .filter((sec) => sec.title || sec.rows.length > 0 || sec.notes.length > 0)
        .map((sec, n) => {
          const measure = /measure/i.test(sec.title ?? "");
          // numbers (and everything under a "Measurements" heading) become big tiles; long writing becomes a note box
          const tiles = sec.rows.filter((r) => r.f.type !== "longtext" && (measure || r.f.type === "number"));
          const rest = sec.rows.filter((r) => !tiles.includes(r));
          return (
            <section key={n} className="space-y-3">
              {sec.title && (
                <h3 className="flex items-center gap-2 pt-1 text-xl font-medium">
                  <span aria-hidden className="inline-block h-6 w-1.5 rounded-full bg-accent" />
                  {sec.title}
                </h3>
              )}
              {/* a note under a Measurements heading is an instruction for the office, not for the master */}
              {!measure &&
                sec.notes.map((t) => (
                <p key={t} className="whitespace-pre-wrap text-base text-muted">
                  {t}
                </p>
                ))}

              {tiles.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {tiles.map(({ f, v }) => {
                    const big = splitNumber(v);
                    return (
                      <div key={f.key} className="rounded-2xl bg-paper-3 p-3">
                        <p className="text-base text-muted">{f.label}</p>
                        {v ? <p className="whitespace-pre-wrap break-words text-3xl font-medium leading-tight">{big.main}</p> : <EmptyBox />}
                        {big.note && <p className="whitespace-pre-wrap text-base leading-snug text-ink-2">{big.note}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {rest.length > 0 && (
                <dl className="divide-y divide-rule rounded-2xl bg-paper-3 px-4">
                  {rest.map(({ f, v }) => (
                    <div key={f.key} className="py-3">
                      <dt className="text-base text-muted">{f.label}</dt>
                      <dd className="mt-0.5 flex items-center gap-2 whitespace-pre-wrap break-words text-xl font-medium leading-snug">
                        {f.type === "color" && (
                          <span aria-hidden className="inline-block h-7 w-7 shrink-0 rounded-full border border-rule-2" style={{ background: values[f.key] }} />
                        )}
                        {v || <EmptyBox />}
                      </dd>
                      {<FieldPictures token={token} itemId={itemId} fieldKey={f.key} label={f.label} />}
                    </div>
                  ))}
                </dl>
              )}
            </section>
          );
        })}

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

/** "17.5 ready (body 16)" -> big "17.5" and a small note "ready (body 16)". Anything that is not a number stays as it is. */
function splitNumber(v: string): { main: string; note: string } {
  const m = /^\s*(\d+(?:[.,/]\d+)?)\s*(.*)$/.exec(v);
  return m ? { main: m[1], note: m[2].trim() } : { main: v, note: "" };
}

/** A blank box for a required field the office has not filled in yet. */
function EmptyBox() {
  return <span role="img" aria-label="Not given yet" className="block h-10 w-full rounded-xl border border-dashed border-rule-2 bg-white" />;
}
