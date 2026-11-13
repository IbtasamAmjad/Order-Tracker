import { displayValue, isAuto, isDisplayOnly, noteFieldKeys, noteKey } from "./items";
import { getOrder, listItems } from "./orders";
import { referencePhotos } from "./stages";

export type SheetItem = {
  label: string;
  colour: string;
  // in the order of the form; headings and notes are printed too (kind) and have no value.
  // photoIds: the pictures added under this field, printed right under it.
  // measure: a number box (with a unit). It sits in the measurements table at its place in the form.
  // note: the small note under a measurement box; newRow / perRow: where the printed measurement rows break
  details: { label: string; value: string; kind?: "heading" | "note"; photoIds?: number[]; measure?: boolean; note?: string; newRow?: boolean; perRow?: number }[];
  measures: { label: string; value: string }[];
  photoIds: number[]; // the item's other pictures (picture fields), printed at the end
  // the tailor slip: the measurements of this item again, in short names, to cut off and hand to the karigar. No dates.
  slip?: { cells: GridCell[]; cols: number; notes: string[] };
  // the karigar paper: the measurements the karigar's own paper is written from, in short names, in the rows the office laid out
  karigar?: { title: string; cols: number; rows: { label: string; value: string }[][] };
};

/** One box of the printed measurements: the name above, the value under it, a small note under that. */
export type GridCell = { label: string; value: string; note?: string; photoIds?: number[]; newRow?: boolean };

/** Boxes in one printed row when the form does not say (the tailor's own sheet has 7 and 5). */
export const DEFAULT_PER_ROW = 4;

/** The cells cut into printed rows: a row is full at `cols` boxes, or ends early before a box that starts a new row. */
export function gridRows(cells: GridCell[], cols: number): GridCell[][] {
  const rows: GridCell[][] = [];
  for (const c of cells) {
    const last = rows[rows.length - 1];
    if (!last || last.length >= cols || (c.newRow && last.length > 0)) rows.push([c]);
    else last.push(c);
  }
  return rows;
}

/** One printed page: one item type (or a group of item types that share a page). */
export type Sheet = { key: string; title: string; items: SheetItem[] };

/**
 * The karigar paper of one item: the boxes the office put in rows (or, when it did not, the measurement boxes in form
 * order, `perRow` to a row), as short name + value. A box with no answer is left out; an empty row is dropped.
 */
export function buildKarigarPaper(
  fields: import("@/db/schema").FieldDef[],
  values: Record<string, string>,
  layout: import("@/db/schema").PrintLayout | undefined,
  perRow: number,
): { cols: number; rows: { label: string; value: string }[][] } | null {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const cell = (key: string) => {
    const f = byKey.get(key);
    const value = f ? displayValue(f, values[key]) : "";
    return f && value ? { label: f.short?.trim() || f.label, value } : null;
  };
  let keyRows = (layout?.karigarRows ?? []).map((r) => r.filter((k) => byKey.has(k)));
  if (!keyRows.some((r) => r.length)) {
    const measure = noteFieldKeys(fields);
    const keys = fields.filter((f) => measure.has(f.key) && !isAuto(f)).map((f) => f.key);
    keyRows = [];
    for (let i = 0; i < keys.length; i += perRow) keyRows.push(keys.slice(i, i + perRow));
  }
  const rows = keyRows.map((r) => r.map(cell).filter((c): c is { label: string; value: string } => c !== null)).filter((r) => r.length > 0);
  return rows.length ? { cols: Math.max(4, ...rows.map((r) => r.length)), rows } : null;
}

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
    const attachedKeys = new Set(item.snapshot.fields.filter((f) => f.type !== "picture").map((f) => f.key)); // under any text or number box

    const flow = item.snapshot.fields
      .filter((f) => f.type !== "picture")
      .map((f) => ({ f, value: displayValue(f, item.values[f.key]), photoIds: under(f.key) }))
      .filter((x) => isDisplayOnly(x.f) || x.value || x.photoIds.length > 0);
    // which slips this item prints (the builder's "Printed slips"; an item with nothing chosen prints the tailor slip)
    const slipStyle = item.snapshot.print?.slip ?? "tailor";
    const wantsTailor = slipStyle === "tailor" || slipStyle === "both";
    const measureHead = item.snapshot.fields.find((f) => f.type === "heading" && /measure/i.test(f.label));
    const karigar = slipStyle === "karigar" || slipStyle === "both" ? buildKarigarPaper(item.snapshot.fields, item.values, item.snapshot.print, measureHead?.perRow ?? DEFAULT_PER_ROW) : null;
    // the tailor slip: everything under a Measurements heading (the notes under it go below the table)
    const slipCells: GridCell[] = [];
    const slipNotes: string[] = [];
    let slipCols = DEFAULT_PER_ROW;
    let inMeasure = false;
    for (const f of item.snapshot.fields) {
      if (f.type === "heading") {
        inMeasure = /measure/i.test(f.label);
        if (inMeasure && f.perRow) slipCols = f.perRow;
        continue;
      }
      if (!inMeasure || f.type === "picture" || isDisplayOnly(f) || isAuto(f)) continue;
      const v = displayValue(f, item.values[f.key]);
      if (!v) continue;
      if (f.type === "longtext" || v.includes("\n") || v.length > 24) slipNotes.push(v);
      else {
        const note = item.values[noteKey(f.key)];
        slipCells.push({ label: f.short?.trim() || f.label, value: v, ...(note ? { note } : {}), ...(f.newRow ? { newRow: true } : {}) });
      }
    }
    sheet.items.push({
      label: item.label,
      colour: item.snapshot.colour,
      details: flow.map((x) => ({
        label: x.f.label,
        value: x.value,
        kind: isDisplayOnly(x.f) ? (x.f.type as "heading" | "note") : undefined,
        ...(x.photoIds.length > 0 ? { photoIds: x.photoIds } : {}),
        ...(x.f.type === "number" ? { measure: true } : {}),
        ...(item.values[noteKey(x.f.key)] ? { note: item.values[noteKey(x.f.key)] } : {}),
        ...(x.f.newRow ? { newRow: true } : {}),
        ...(x.f.type === "heading" && x.f.perRow ? { perRow: x.f.perRow } : {}),
      })),
      measures: flow.filter((x) => x.f.type === "number").map((x) => ({ label: x.f.label, value: x.value })),
      photoIds: pics.filter((r) => !attachedKeys.has(r.fieldKey ?? "")).map((r) => r.id),
      ...(slipCells.length > 0 && wantsTailor ? { slip: { cells: slipCells, cols: slipCols, notes: slipNotes } } : {}),
      ...(karigar ? { karigar: { title: `${order.customerName} (${order.orderNumber})`, ...karigar } } : {}),
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

/** Height (mm) of a picture inside a box of the measurements table (a field with up to MAX_CELL_PHOTOS pictures stays in the table). */
export const FIELD_CELL_PHOTO_MM = 16;
export const MAX_CELL_PHOTOS = 3;

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
  | { type: "heading"; label: string; measure: boolean }
  | { type: "note"; label: string }
  | { type: "row"; label: string; value: string; photoIds: number[] }
  | { type: "grid"; cols: number; cells: GridCell[] };

/**
 * The order the printed item is drawn in: headings, rows (each with the pictures added under that field), and a grid for
 * measurements (short answers under a "Measurements" heading, and number fields). The grid has `cols` boxes in a row
 * (the heading's "boxes in one printed row"; a box can also start a new row), like the tailor's own sheet. Notes under a
 * Measurements heading are instructions for the office, so they are not printed.
 */
export function layoutDetails(details: SheetItem["details"], measures: SheetItem["measures"]): Block[] {
  const out: Block[] = [];
  let inMeasure = false;
  let cols = DEFAULT_PER_ROW;
  let cells: GridCell[] = [];
  const flush = () => {
    if (cells.length > 0) out.push({ type: "grid", cols, cells });
    cells = [];
  };
  for (const d of details) {
    if (d.kind === "heading") {
      flush();
      inMeasure = /measure/i.test(d.label);
      cols = d.perRow ?? DEFAULT_PER_ROW;
      out.push({ type: "heading", label: d.label, measure: inMeasure });
    } else if (d.kind === "note") {
      if (!inMeasure) out.push({ type: "note", label: d.label });
    } else if ((inMeasure || d.measure) && (d.photoIds?.length ?? 0) <= MAX_CELL_PHOTOS && d.value.length <= 24 && !d.value.includes("\n")) {
      // a short answer stays in the table even with a few pictures (they sit small inside its box), so the table is never cut in pieces
      cells.push({
        label: d.label,
        value: d.value,
        ...(d.note ? { note: d.note } : {}),
        ...(d.newRow ? { newRow: true } : {}),
        ...(d.photoIds?.length ? { photoIds: d.photoIds } : {}),
      });
    } else {
      flush();
      out.push({ type: "row", label: d.label, value: d.value, photoIds: d.photoIds ?? [] });
    }
  }
  flush();
  // older data (number boxes only in `measures`): they go in a table at the end
  if (measures.length > 0 && !details.some((d) => d.measure)) out.push({ type: "grid", cols: DEFAULT_PER_ROW, cells: measures });
  return out;
}
