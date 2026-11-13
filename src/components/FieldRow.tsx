import type { FieldDef } from "@/db/schema";
import { splitMulti } from "@/lib/items";
import { AutoText } from "./AutoText";
import { ColorInput } from "./ColorInput";
import { PictureInput } from "./PictureInput";
import { Icon } from "./Icon";
import { RequiredMark, input, select, textarea } from "./ui";

/** Fields that need the whole row (long writing, pictures, choices, headings); the rest can sit two to a row. */
export function isWideField(f: FieldDef): boolean {
  return ["longtext", "picture", "radio", "checkboxes", "heading", "note"].includes(f.type);
}

/**
 * One form field of any type, with its label. Used for Admin's customer form and the master's form.
 * `value` is the saved answer (checkboxes: one choice per line). Pictures are handled by the caller.
 * `compact` is Admin's tight version: smaller labels, choices in a row, a red * for a required field.
 */
export function FieldRow({
  f,
  name,
  value,
  pictureNote,
  saved,
  pasteFrom = [],
  compact = false,
  missing = false,
}: {
  f: FieldDef;
  name: string;
  value: string;
  pictureNote?: string;
  /** on an existing customer: the pictures already saved for this field, shown right here */
  saved?: { itemId: number; photos: { id: number }[] };
  /** a picture field: names of the item's text boxes whose pasted pictures (Ctrl+V) are added to it */
  pasteFrom?: string[];
  compact?: boolean;
  /** the form was saved with this required field empty: mark it and say so right here */
  missing?: boolean;
}) {
  const unit = f.unit && f.type === "number" ? ` (${f.unit})` : "";
  // the master reads "(please fill in)"; Admin gets a clear red * instead, and the form says once what it means
  const label = compact ? (
    <>
      {f.label}
      {unit}
      {f.required && <RequiredMark />}
    </>
  ) : (
    `${f.label}${unit}${f.required ? " (please fill in)" : ""}`
  );
  const labelClass = compact ? "mb-1 block text-base font-medium" : "mb-1 block text-lg font-medium";
  const options = f.options ?? [];

  if (f.type === "heading") {
    return <h3 className={compact ? "border-b border-rule pb-1 pt-1 text-lg font-medium" : "border-b-2 border-base-300 pb-1 pt-2 text-xl font-medium"}>{f.label}</h3>;
  }
  if (f.type === "note") {
    return <p className={`whitespace-pre-wrap opacity-80 ${compact ? "text-sm" : "text-base"}`}>{f.label}</p>;
  }

  if (f.type === "picture") {
    return (
      <div>
        <span className={labelClass}>{label}</span>
        {saved && <SavedPictures photos={saved.photos} label={f.label} itemId={saved.itemId} />}
        {pictureNote ? <p className="bg-base-200 p-3 text-base">{pictureNote}</p> : <PictureInput name={name.replace(/^v:/, "pic:")} pasteInto={pasteFrom} />}
      </div>
    );
  }

  if (f.type === "color") {
    return (
      <div>
        <span className={labelClass}>{label}</span>
        <ColorInput name={name} value={value} />
      </div>
    );
  }

  if (f.type === "radio" || f.type === "checkboxes") {
    const picked = new Set(f.type === "checkboxes" ? splitMulti(value) : [value]);
    const choice = compact
      ? "inline-flex min-h-9 items-center gap-2 rounded-full bg-paper-3 px-3 py-1 text-base shadow-[inset_0_0_0_1.5px_var(--color-muted)]"
      : "flex min-h-12 items-center gap-3 rounded-full bg-paper-3 shadow-[inset_0_0_0_1.5px_var(--color-muted)] px-3 py-2 text-lg";
    return (
      <fieldset className={compact ? "" : "space-y-2"}>
        <legend className={compact ? "mb-1 text-base font-medium" : "mb-1 text-lg font-medium"}>{label}</legend>
        {options.length === 0 && <p className="text-base">No choices set for this field yet.</p>}
        <div className={compact ? "flex flex-wrap gap-2" : "contents"}>
          {options.map((o) => (
            <label key={o} className={choice}>
              <input
                type={f.type === "radio" ? "radio" : "checkbox"}
                name={name}
                value={o}
                defaultChecked={picked.has(o)}
                className={f.type === "radio" ? "radio radio-primary" : "checkbox checkbox-primary"}
              />
              {o}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  const withPictures = !!f.pictures && (f.type === "text" || f.type === "longtext" || f.type === "number") && !pictureNote;
  const control =
    f.type === "longtext" ? (
      <textarea name={name} rows={compact ? 3 : 4} defaultValue={value} className={textarea} aria-label={withPictures ? f.label : undefined} aria-invalid={missing || undefined} />
    ) : f.type === "select" ? (
      <select name={name} defaultValue={value} className={select} aria-invalid={missing || undefined}>
        <option value="">-</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    ) : f.type === "yesno" ? (
      <select name={name} defaultValue={value} className={select} aria-invalid={missing || undefined}>
        <option value="">-</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    ) : f.type === "text" ? (
      // a text box takes several lines: Enter starts a new line and pasted lines stay apart
      <AutoText name={name} defaultValue={value} ariaLabel={withPictures ? f.label : undefined} invalid={missing} />
    ) : (
      <input
        name={name}
        type={f.type === "date" ? "date" : f.type === "time" ? "time" : f.type === "phone" ? "tel" : "text"} // a "number" box takes words too (the unit still shows)
        inputMode={f.type === "phone" ? "tel" : undefined}
        defaultValue={value}
        placeholder={["customername", "deliverydate", "ordernumber", "designnumber"].includes(f.type) ? "Filled in from the order" : undefined}
        className={input}
        aria-label={withPictures ? f.label : undefined}
        aria-invalid={missing || undefined}
      />
    );

  return (
    // a field that has pictures gets a soft frame, so the pictures clearly belong to this box
    <div className={compact ? "rounded-2xl has-[img]:border has-[img]:border-accent/25 has-[img]:bg-accent-soft/30 has-[img]:p-2.5" : undefined}>
      {withPictures ? (
        <>
          <span className={labelClass}>{label}</span>
          {/* the small + sits at the end of the box, in the same row; the pictures sit under the box */}
          <PictureInput name={name.replace(/^v:/, "pic:")} pasteInto={[name]} inline={control} tall={f.type === "longtext"} />
          {saved && <SavedPictures photos={saved.photos} label={f.label} itemId={saved.itemId} />}
        </>
      ) : (
        <>
          <label className="block">
            <span className={labelClass}>{label}</span>
            {control}
          </label>
          {/* any text or number box keeps a picture pasted into it, shown right under that box */}
          {compact && (f.type === "text" || f.type === "longtext" || f.type === "number") && !pictureNote && (
            <>
              {saved && <SavedPictures photos={saved.photos} label={f.label} itemId={saved.itemId} />}
              <PictureInput name={name.replace(/^v:/, "pic:")} pasteInto={[name]} pasteOnly />
            </>
          )}
        </>
      )}
      {missing && (
        <p role="alert" className="mt-1 flex items-center gap-1.5 text-sm font-medium text-bad">
          <Icon name="alert" className="h-4 w-4 shrink-0" />
          Please fill in {f.label}
        </p>
      )}
    </div>
  );
}

/**
 * The pictures already saved on a field: small pictures to tap and open full size, and one "Download all" button
 * (a single picture keeps its own small download icon).
 */
function SavedPictures({ photos, label, itemId }: { photos: { id: number }[]; label: string; itemId: number }) {
  if (photos.length === 0) return null;
  const many = photos.length > 1;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-rule pt-2">
      {photos.map((p) => (
        <a
          key={p.id}
          href={`/api/admin/photos/${p.id}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Open this picture"
          className="block h-11 w-11 overflow-hidden rounded-lg border border-rule bg-paper-3 shadow-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/admin/photos/${p.id}?thumb=1`} alt={label} className="h-full w-full object-cover" />
        </a>
      ))}
      <a
        href={many ? `/api/admin/items/${itemId}/pictures?ids=${photos.map((p) => p.id).join(",")}` : `/api/admin/photos/${photos[0].id}?download=1`}
        download
        className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium text-accent-deep hover:bg-accent-soft"
      >
        <Icon name="download" className="h-4 w-4" />
        {many ? `Download all (${photos.length})` : "Download"}
      </a>
    </div>
  );
}
