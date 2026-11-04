import type { FieldDef } from "@/db/schema";
import { splitMulti } from "@/lib/items";
import { input, select, textarea } from "./ui";

/**
 * One form field of any type, with its label. Used for Admin's customer form and the master's form.
 * `value` is the saved answer (checkboxes: one choice per line). Pictures are handled by the caller.
 */
export function FieldRow({
  f,
  name,
  value,
  pictureNote,
}: {
  f: FieldDef;
  name: string;
  value: string;
  pictureNote?: string;
}) {
  const label = `${f.label}${f.unit && f.type === "number" ? ` (${f.unit})` : ""}${f.required ? " *" : ""}`;
  const options = f.options ?? [];

  if (f.type === "heading") {
    return <h3 className="border-b-2 border-base-300 pb-1 pt-2 text-xl font-medium">{f.label}</h3>;
  }
  if (f.type === "note") {
    return <p className="whitespace-pre-wrap text-base opacity-80">{f.label}</p>;
  }

  if (f.type === "picture") {
    return (
      <div>
        <span className="mb-1 block text-lg font-medium">{label}</span>
        <p className=" bg-base-200 p-3 text-base">{pictureNote ?? "Add pictures below, after you save."}</p>
      </div>
    );
  }

  if (f.type === "radio" || f.type === "checkboxes") {
    const picked = new Set(f.type === "checkboxes" ? splitMulti(value) : [value]);
    return (
      <fieldset className="space-y-2">
        <legend className="mb-1 text-lg font-medium">{label}</legend>
        {options.length === 0 && <p className="text-base">No choices set for this field yet.</p>}
        {options.map((o) => (
          <label key={o} className="flex min-h-12 items-center gap-3 rounded-full bg-paper-3 shadow-[inset_0_0_0_1.5px_var(--color-muted)] px-3 py-2 text-lg">
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
      </fieldset>
    );
  }

  return (
    <label className="block">
      <span className="mb-1 block text-lg font-medium">{label}</span>
      {f.type === "longtext" ? (
        <textarea name={name} rows={4} defaultValue={value} className={textarea} />
      ) : f.type === "select" ? (
        <select name={name} defaultValue={value} className={select}>
          <option value="">-</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : f.type === "yesno" ? (
        <select name={name} defaultValue={value} className={select}>
          <option value="">-</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      ) : (
        <input
          name={name}
          type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "time" ? "time" : f.type === "phone" ? "tel" : "text"}
          step={f.type === "number" ? "any" : undefined}
          inputMode={f.type === "number" ? "decimal" : f.type === "phone" ? "tel" : undefined}
          defaultValue={value}
          className={input}
        />
      )}
    </label>
  );
}
