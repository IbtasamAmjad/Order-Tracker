import { displayValue, isDisplayOnly } from "./items";
import { getOrder, listItems } from "./orders";
import { referencePhotos } from "./stages";

export type SheetItem = {
  label: string;
  colour: string;
  // in the order of the form; headings and notes are printed too (kind) and have no value
  details: { label: string; value: string; kind?: "heading" | "note" }[];
  measures: { label: string; value: string }[];
  photoIds: number[];
};

/** One printed page: one item type (or a group of item types that share a page). */
export type Sheet = { key: string; title: string; items: SheetItem[] };

export type PrintData = {
  orderNumber: number;
  customerName: string;
  designNumber: string | null;
  karigarDueDate: string; // never "My due date": the printout travels with the fabric
  notes: string;
  sheets: Sheet[];
};

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

    const flow = item.snapshot.fields
      .filter((f) => f.type !== "picture")
      .map((f) => ({ f, value: displayValue(f, item.values[f.key]) }))
      .filter((x) => isDisplayOnly(x.f) || x.value);
    sheet.items.push({
      label: item.label,
      colour: item.snapshot.colour,
      details: flow
        .filter((x) => x.f.type !== "number")
        .map((x) => ({ label: x.f.label, value: x.value, kind: isDisplayOnly(x.f) ? (x.f.type as "heading" | "note") : undefined })),
      measures: flow.filter((x) => x.f.type === "number").map((x) => ({ label: x.f.label, value: x.value })),
      photoIds: referencePhotos(item.id).map((r) => r.id),
    });
  }

  return {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    designNumber: order.designNumber,
    karigarDueDate: order.karigarDueDate,
    notes: order.details,
    sheets: [...sheets.values()],
  };
}

/** Picture height (mm) so all of a page's pictures fit: fewer pictures = bigger. */
export function photoHeightMm(sheet: Sheet): number {
  const n = sheet.items.reduce((sum, i) => sum + i.photoIds.length, 0);
  return n <= 2 ? 55 : n <= 4 ? 40 : n <= 8 ? 28 : 20;
}
