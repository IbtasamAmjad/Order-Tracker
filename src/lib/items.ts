import { colourName } from "./colour-name";
import type { FieldDef, ItemSnapshot } from "@/db/schema";

export type ItemValues = Record<string, string>;

const isEmpty = (v: string | undefined) => v === undefined || v.trim() === "";

/** Types that choose from a list of options. */
export const CHOICE_TYPES = ["select", "radio", "checkboxes"] as const;
export const isChoice = (f: FieldDef) => (CHOICE_TYPES as readonly string[]).includes(f.type);

/**
 * Names used by more than one field in a form (ignoring capitals and spaces at the ends). Headings and notes are
 * only text on the form, so they may repeat. Two answerable fields with one name cannot be told apart in a step's
 * list, on the printed sheet or on the customer form.
 */
export function duplicateFieldNames(fields: { label: string; type: string }[]): string[] {
  const seen = new Map<string, { name: string; n: number }>();
  for (const f of fields) {
    const name = f.label.trim();
    if (!name || isDisplayOnly(f)) continue;
    const key = name.toLowerCase();
    const hit = seen.get(key);
    if (hit) hit.n++;
    else seen.set(key, { name, n: 1 });
  }
  return [...seen.values()].filter((x) => x.n > 1).map((x) => x.name);
}

/** Fields the master can type into (pictures are uploaded separately). */
/** Blocks that only show text (a bold heading or a note): nothing to fill in. */
export const isDisplayOnly = (f: { type: string }) => f.type === "heading" || f.type === "note";

/**
 * The customer name, order number, design number and delivery date: text boxes that start with the order's value (name; Karigar due date, never
 * My due date) and can be changed by the office. The date is a separate field on purpose, so a screenshot of the form
 * can leave it out.
 */
export const AUTO_TYPES = ["customername", "deliverydate", "ordernumber", "designnumber"] as const;

type AutoSource = { customerName: string; karigarDueDate: string; orderNumber?: number | null; designNumber?: string | null };
export const isAuto = (f: { type: string }) => (AUTO_TYPES as readonly string[]).includes(f.type);

/** "2026-11-15" -> "15 November 2026" */
function longDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** The values of a form's auto fields, from the order. */
export function autoValues(fields: { key: string; type: string }[], order: AutoSource): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (f.type === "customername" && order.customerName.trim()) out[f.key] = order.customerName.trim();
    if (f.type === "deliverydate" && order.karigarDueDate) out[f.key] = longDay(order.karigarDueDate);
    if (f.type === "ordernumber" && order.orderNumber) out[f.key] = String(order.orderNumber);
    if (f.type === "designnumber" && order.designNumber) out[f.key] = order.designNumber;
  }
  return out;
}

/**
 * The auto fields get the order's value when they are empty, and follow the order when the office has not changed
 * them (still equal to what the order said before: pass that as `old`). A value the office typed is kept.
 */
export function withAutoValues(
  fields: { key: string; type: string }[],
  values: ItemValues,
  order: AutoSource,
  old?: AutoSource,
): ItemValues {
  const out = { ...values };
  const now = autoValues(fields, order);
  const before = old ? autoValues(fields, old) : {};
  for (const f of fields) {
    if (!isAuto(f)) continue;
    const cur = (out[f.key] ?? "").trim();
    if (cur === "" || cur === before[f.key]) {
      if (now[f.key]) out[f.key] = now[f.key];
      else delete out[f.key];
    }
  }
  return out;
}

export const isTextEditable = (f: FieldDef) => !!f.masterCanEdit && f.type !== "picture" && !isDisplayOnly(f) && !isAuto(f);

/** One option per line -> clean list (no blanks, no repeats). */
export function parseOptions(text: string): string[] {
  return [...new Set(text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))];
}

/** Checkbox answers are stored one per line. */
export const splitMulti = (v: string | undefined) => (v ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

/**
 * Required fields left empty. This is only a warning: Admin may submit anyway.
 * Pictures, headings and notes are skipped.
 */
export function missingRequired(fields: FieldDef[], values: ItemValues): FieldDef[] {
  return fields.filter((f) => f.required && f.type !== "picture" && !isDisplayOnly(f) && !isAuto(f) && isEmpty(values[f.key]));
}

/**
 * Fields marked "Warn if empty" that are still empty. The office cannot send a customer until these are filled in;
 * a field without the flag may stay empty. Pictures, headings and notes are skipped.
 */
export function missingFields(fields: FieldDef[], values: ItemValues): FieldDef[] {
  return missingRequired(fields, values);
}

/** "#1f69d1", "1F69D1" or "#abc" -> "#1F69D1"; anything that is not a HEX color -> "". */
export function normalizeHex(v: string): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return "";
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${h.toUpperCase()}`;
}

/** Keep only values for known input fields, trimmed; choices must be one of the options. */
export function cleanValues(fields: FieldDef[], raw: ItemValues): ItemValues {
  const out: ItemValues = {};
  for (const f of fields) {
    if (f.type === "picture" || isDisplayOnly(f)) continue;
    let v = (raw[f.key] ?? "").replace(/\r\n?/g, "\n").trim(); // lines are kept, as plain new lines
    if (f.type === "checkboxes") {
      const picked = splitMulti(v).filter((x) => !f.options?.length || f.options.includes(x));
      v = picked.join("\n");
    } else if (f.type === "color") {
      v = normalizeHex(v);
    } else if ((f.type === "select" || f.type === "radio") && f.options?.length && !f.options.includes(v)) {
      v = "";
    }
    if (v) out[f.key] = v;
  }
  return out;
}

/**
 * How many of a form's fields are filled in. Headings and notes are not counted. A picture field counts once a
 * picture is attached to it (pass the keys of the picture fields that have one).
 */
export function fieldProgress(fields: FieldDef[], values: ItemValues, pictureKeys: Iterable<string> = []): { filled: number; total: number } {
  const withPicture = new Set(pictureKeys);
  const asked = fields.filter((f) => !isDisplayOnly(f) && !isAuto(f));
  const filled = asked.filter((f) => (f.type === "picture" ? withPicture.has(f.key) : !isEmpty(values[f.key]))).length;
  return { filled, total: asked.length };
}

/** Keys of the picture fields that hold the design the customer chose (named Reference picture, Design picture...). */
export function designFieldKeys(fields: FieldDef[]): string[] {
  return fields.filter((f) => f.type === "picture" && /reference|design/i.test(f.label)).map((f) => f.key);
}

/** "Sherwani", or "Sherwani 1", "Sherwani 2" when the same item appears more than once. */
export function itemLabel(name: string, index: number, total: number): string {
  return total > 1 ? `${name} ${index + 1}` : name;
}

export type NewItem = { templateId: number; label: string; snapshot: ItemSnapshot; values: ItemValues };

export function displayValue(f: FieldDef, v: string | undefined): string {
  if (isDisplayOnly(f) || f.type === "picture" || isEmpty(v)) return "";
  if (f.type === "yesno") return v === "yes" ? "Yes" : "No";
  if (f.type === "checkboxes") return splitMulti(v).join(", ");
  if (f.type === "color") return colourName(v); // a colour reads as its name ("Maroon"), never as a code
  // the unit goes after a plain number ("42" -> "42 inch"); words and numbers typed together stay as typed ("24 ready")
  return f.unit && f.type === "number" && /^[\d\s.,/]*\d[\d\s.,/]*$/.test(v!) ? `${v!.trim()} ${f.unit}` : v!;
}
