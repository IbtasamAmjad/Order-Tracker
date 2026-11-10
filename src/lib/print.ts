import { displayValue, isDisplayOnly } from "./items";
import { getOrder, listItems } from "./orders";
import { referencePhotos } from "./stages";

export type SheetItem = {
  label: string;
  colour: string;
  // in the order of the form; headings and notes are printed too (kind) and have no value.
  // photoIds: the pictures added under this field, printed right under it.
  details: { label: string; value: string; kind?: "heading" | "note"; photoIds?: number[] }[];
  measures: { label: string; value: string }[];
  photoIds: number[]; // the item's other pictures (picture fields), printed at the end
};

/** One printed page: one item type (or a group of item types that share a page). */
export type Sheet = { key: string; title: string; items: SheetItem[] };

export type PrintData = {
  orderNumber: number;
  customerName: string;
  designNumber: string | null;
  karigarDueDate: string; // never "My due date": the printout travels with the fabric
  dueLabel: string; // the same date in words, like "5 November 2026"
  notes: string;
  sheets: Sheet[];
};

/** "2026-11-05" -> "5 November 2026". */
export function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Pages for an order: one per item type. Picture / measurement sizing is decided by the renderers.
 */
export function buildPrintData(orderId: number): PrintData | null {
  const order = getOrder(orderId);
  if (!order) return null;

  const sheets = new Map<string, Sheet>();
  for (const item of listItems(orderId)) {
    const key = `t:${item.templateId ?? item.snapshot.templateName}`;
    const sheet = sheets.get(key) ?? { key, title: item.snapshot.templateName, items: [] };
    sheets.set(key, sheet);

    // pictures added under a field are printed under that field; the rest go at the end
    const pics = referencePhotos(item.id);
    const under = (key: string) => pics.filter((r) => r.fieldKey === key).map((r) => r.id);
    const attachedKeys = new Set(item.snapshot.fields.filter((f) => f.pictures).map((f) => f.key));

    const flow = item.snapshot.fields
      .filter((f) => f.type !== "picture")
      .map((f) => ({ f, value: displayValue(f, item.values[f.key]), photoIds: f.pictures ? under(f.key) : [] }))
      .filter((x) => isDisplayOnly(x.f) || x.value || x.photoIds.length > 0);
    sheet.items.push({
      label: item.label,
      colour: item.snapshot.colour,
      details: flow
        .filter((x) => x.f.type !== "number")
        .map((x) => ({
          label: x.f.label,
          value: x.value,
          kind: isDisplayOnly(x.f) ? (x.f.type as "heading" | "note") : undefined,
          ...(x.photoIds.length > 0 ? { photoIds: x.photoIds } : {}),
        })),
      measures: flow.filter((x) => x.f.type === "number").map((x) => ({ label: x.f.label, value: x.value })),
      photoIds: pics.filter((r) => !attachedKeys.has(r.fieldKey ?? "")).map((r) => r.id),
    });
  }

  return {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    designNumber: order.designNumber,
    karigarDueDate: order.karigarDueDate,
    dueLabel: longDate(order.karigarDueDate),
    notes: order.details,
    sheets: [...sheets.values()],
  };
}

/** Height (mm) of a picture printed under a field: small, so the page stays easy to read. */
export const FIELD_PHOTO_MM = 24;

/** Picture height (mm) for the item's other pictures at the end of a page: fewer pictures = bigger, but never large. */
export function photoHeightMm(sheet: Sheet): number {
  const n = sheet.items.reduce((sum, i) => sum + i.photoIds.length, 0);
  return n <= 2 ? 40 : n <= 4 ? 32 : n <= 8 ? 24 : 18;
}

/** Every picture id used on the sheets, field pictures included (the PDF fetches them all). */
export function allPhotoIds(data: PrintData): number[] {
  return data.sheets.flatMap((sh) => sh.items.flatMap((i) => [...i.photoIds, ...i.details.flatMap((d) => d.photoIds ?? [])]));
}

export type Block =
  | { type: "heading"; label: string }
  | { type: "note"; label: string }
  | { type: "row"; label: string; value: string; photoIds: number[] }
  | { type: "grid"; cells: { label: string; value: string }[] };

/**
 * The order the printed item is drawn in: headings, rows (each with the pictures added under that field), and a grid for
 * measurements (short answers under a "Measurements" heading, and number fields). Notes under a Measurements heading are
 * instructions for the office, so they are not printed.
 */
export function layoutDetails(details: SheetItem["details"], measures: SheetItem["measures"]): Block[] {
  const out: Block[] = [];
  let inMeasure = false;
  let cells: { label: string; value: string }[] = [];
  const flush = () => {
    if (cells.length > 0) out.push({ type: "grid", cells });
    cells = [];
  };
  for (const d of details) {
    if (d.kind === "heading") {
      flush();
      inMeasure = /measure/i.test(d.label);
      out.push({ type: "heading", label: d.label });
    } else if (d.kind === "note") {
      if (!inMeasure) out.push({ type: "note", label: d.label });
    } else if (inMeasure && !(d.photoIds?.length) && d.value.length <= 24 && !d.value.includes("\n")) {
      cells.push({ label: d.label, value: d.value });
    } else {
      flush();
      out.push({ type: "row", label: d.label, value: d.value, photoIds: d.photoIds ?? [] });
    }
  }
  flush();
  if (measures.length > 0) out.push({ type: "grid", cells: measures });
  return out;
}
