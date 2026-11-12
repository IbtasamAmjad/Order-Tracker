import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, shipmentItems, shipments } from "@/db/schema";
import { mine, masterNames } from "./assign";
import { isDisplayOnly } from "./items";
import { itemStageViews, referencePhotos } from "./stages";
import { shippableItems } from "./shipping";
import { colourName } from "./colour-name";

import { DUE_FILTERS, STATUS_FILTERS, STATUS_TEXT, type ItemStatus } from "./item-filter-options";

export { DUE_FILTERS, STATUS_FILTERS, STATUS_TEXT };
export type { ItemStatus };

/** One ordered item, with everything the item search shows. */
export type ItemRow = {
  itemId: number;
  orderId: number;
  orderNumber: number;
  customerName: string;
  designNumber: string | null;
  itemName: string; // the kind of item: Shoes, Shawls, Sherwani...
  label: string; // "Shoes", or "Shoes 2" when the order has more than one
  colourText: string; // from the colour field, like "Ivory silk"
  colourHex: string | null; // from the colour code field
  embroidery: string; // the embroidery details written on the form
  photoIds: number[]; // reference pictures
  status: ItemStatus;
  stage: string | null; // the step it is at now
  karigarDueDate: string;
  masterNames: string[];
};

const LABEL_COLOUR = /colou?r/i;
const LABEL_EMBROIDERY = /embroider/i;

/** Items of orders that are not cancelled or archived (finished and shipped ones included, they show as Shipped). */
function itemsToList(masterId?: number) {
  return db
    .select({ item: orderItems, order: orders })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(inArray(orders.status, ["active", "completed"]), isNotNull(orders.sentAt), masterId ? mine(masterId) : undefined))
    .orderBy(orders.orderNumber, orderItems.position)
    .all();
}

/** Every item that is in a sent shipment. */
function shippedItemIds(): Set<number> {
  return new Set(
    db
      .select({ itemId: shipmentItems.itemId })
      .from(shipmentItems)
      .innerJoin(shipments, eq(shipmentItems.shipmentId, shipments.id))
      .where(and(eq(shipments.status, "submitted"), isNull(shipmentItems.returnedAt)))
      .all()
      .map((r) => r.itemId),
  );
}

/** Where an item is in production, from its steps and its shipment. */
export function itemProduction(itemId: number, shipped: boolean): { status: ItemStatus; stage: string | null } {
  if (shipped) return { status: "shipped", stage: null };
  const steps = itemStageViews(itemId);
  if (steps.length === 0) return { status: "not-started", stage: null };
  const done = steps.filter((s) => s.status === "done").length;
  if (done === steps.length) return { status: "ready", stage: null };
  const now = steps.find((s) => s.status !== "done");
  return { status: done > 0 ? "in-production" : "not-started", stage: now?.label ?? null };
}

/** All ordered items as rows, newest orders first within the list order of the orders. */
export function itemRows(masterId?: number): ItemRow[] {
  const shipped = shippedItemIds();
  return itemsToList(masterId).map(({ item, order }) => {
    const fields = item.snapshot.fields;
    const value = (f: (typeof fields)[number]) => (item.values[f.key] ?? "").trim();
    const colourField = fields.find((f) => (f.type === "text" || f.type === "select" || f.type === "radio") && LABEL_COLOUR.test(f.label) && value(f));
    const hexField = fields.find((f) => f.type === "color" && value(f));
    const embroideryField = fields.find((f) => f.type !== "picture" && !isDisplayOnly(f) && LABEL_EMBROIDERY.test(f.label) && value(f));
    const prod = itemProduction(item.id, shipped.has(item.id) || order.status === "completed");
    return {
      itemId: item.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      designNumber: order.designNumber,
      itemName: item.snapshot.templateName,
      label: item.label,
      colourText: colourField ? value(colourField) : hexField ? colourName(value(hexField)) : "",
      colourHex: hexField ? value(hexField) : null,
      embroidery: embroideryField ? value(embroideryField) : "",
      photoIds: referencePhotos(item.id).map((r) => r.id),
      status: prod.status,
      stage: prod.stage,
      karigarDueDate: order.karigarDueDate,
      masterNames: masterNames(order.id),
    };
  });
}

/** What the search looks through: the customer, order and design number, the item, and everything written on its form. */
function haystack(r: ItemRow, values: string): string {
  return [`#${r.orderNumber}`, r.orderNumber, r.customerName, r.designNumber ?? "", r.itemName, r.label, r.colourText, colourName(r.colourHex), r.embroidery, values].join(" ").toLowerCase();
}

export type ItemQuery = { q?: string; type?: string; status?: string; due?: string; design?: string };

function daysLeft(date: string, now = new Date()): number {
  const d = new Date(`${date}T00:00:00`);
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

/** The rows that match a search (words in any order, all of them must be found), an item kind and a status. */
export function searchItems(rows: ItemRow[], query: ItemQuery): ItemRow[] {
  const words = (query.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const wanted = STATUS_FILTERS.find((s) => s.value === (query.status ?? ""))?.match;
  const dueDays = DUE_FILTERS.find((d) => d.value === (query.due ?? ""))?.days;
  const values = new Map<number, string>();
  if (words.length > 0) {
    for (const it of db.select({ id: orderItems.id, values: orderItems.values }).from(orderItems).all()) values.set(it.id, Object.values(it.values).join(" "));
  }
  return rows.filter((r) => {
    if (query.type && r.itemName !== query.type) return false;
    if (wanted && !wanted.includes(r.status)) return false;
    if (query.design && !(r.designNumber ?? "").toLowerCase().includes(query.design.toLowerCase())) return false;
    if (dueDays !== undefined && dueDays !== null) {
      if (r.status === "ready" || r.status === "shipped") return false;
      const left = daysLeft(r.karigarDueDate);
      if (dueDays < 0 ? left >= 0 : left > dueDays) return false;
    }
    if (words.length === 0) return true;
    const text = haystack(r, values.get(r.itemId) ?? "");
    return words.every((w) => text.includes(w));
  });
}

/** The total quantity of each kind of item, biggest first. One ordered item counts as one. */
export function quantityByItem(rows: ItemRow[]): { itemName: string; total: number; byStatus: Record<ItemStatus, number> }[] {
  const out = new Map<string, { itemName: string; total: number; byStatus: Record<ItemStatus, number> }>();
  for (const r of rows) {
    const e = out.get(r.itemName) ?? { itemName: r.itemName, total: 0, byStatus: { "not-started": 0, "in-production": 0, ready: 0, shipped: 0 } };
    e.total++;
    e.byStatus[r.status]++;
    out.set(r.itemName, e);
  }
  return [...out.values()].sort((a, b) => b.total - a.total || a.itemName.localeCompare(b.itemName));
}

/** One step that is waiting for a master: the first step of an item that is not done. */
export type PendingStep = {
  itemId: number;
  orderId: number;
  orderNumber: number;
  customerName: string;
  designNumber: string | null;
  label: string; // the item
  stepKey: string;
  stepLabel: string;
  photoRule: string; // none | optional | upload | required
  confirmed: boolean; // the master has confirmed the order; he cannot work before
  karigarDueDate: string;
};

/** The step each unfinished item of this master is waiting at, the nearest due date first. */
export function pendingWork(masterId: number): PendingStep[] {
  const rows = itemRows(masterId).filter((r) => r.status === "not-started" || r.status === "in-production");
  const out: PendingStep[] = [];
  for (const r of rows) {
    const now = itemStageViews(r.itemId).find((s) => s.status !== "done");
    if (!now) continue;
    const order = db.select({ confirmedAt: orders.confirmedAt }).from(orders).where(eq(orders.id, r.orderId)).get();
    out.push({
      itemId: r.itemId,
      orderId: r.orderId,
      orderNumber: r.orderNumber,
      customerName: r.customerName,
      designNumber: r.designNumber,
      label: r.label,
      stepKey: now.key,
      stepLabel: now.label,
      photoRule: now.photo,
      confirmed: !!order?.confirmedAt,
      karigarDueDate: r.karigarDueDate,
    });
  }
  return out.sort((a, b) => a.karigarDueDate.localeCompare(b.karigarDueDate) || a.orderNumber - b.orderNumber);
}

/** Where each item of one order stands, for the master: sent, finished and waiting in the cart, or still to make. */
export type ItemState = { itemId: number; label: string; colour: string; state: "sent" | "ready" | "making"; stage: string | null };

export function itemStatesOfOrder(orderId: number): ItemState[] {
  const colours = new Map(db.select({ id: orderItems.id, snapshot: orderItems.snapshot }).from(orderItems).where(eq(orderItems.orderId, orderId)).all().map((i) => [i.id, i.snapshot.colour]));
  return shippableItems(orderId).map((i) => {
    const colour = colours.get(i.id) ?? "#64748b";
    if (i.shippedIn !== null) return { itemId: i.id, label: i.label, colour, state: "sent", stage: null };
    if (i.ready) return { itemId: i.id, label: i.label, colour, state: "ready", stage: null };
    const now = itemStageViews(i.id).find((s) => s.status !== "done");
    return { itemId: i.id, label: i.label, colour, state: "making", stage: now?.label ?? null };
  });
}

/** One plain sentence: "1 of 2 items finished. 1 left to make." */
export function itemStatesSummary(states: ItemState[]): string {
  if (states.length === 0) return "";
  const left = states.filter((x) => x.state === "making").length;
  const done = states.length - left;
  if (left === 0) return states.every((x) => x.state === "sent") ? "All items are sent." : "All items are finished.";
  if (done === 0) return `${left} item${left === 1 ? "" : "s"} to make.`;
  return `${done} of ${states.length} items finished. ${left} left to make.`;
}
