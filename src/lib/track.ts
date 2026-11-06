import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, shipmentItems, shipments } from "@/db/schema";
import { completeStage, itemStageViews } from "./stages";

export type TrackStep = { label: string; state: "done" | "current" | "todo" };

/** "Order received", then the steps, then "Shipped". The first step not done yet is the current one. */
function build(steps: { label: string; done: boolean }[], shipped: boolean): TrackStep[] {
  const all = [{ label: "Order received", done: true }, ...steps, { label: "Shipped", done: shipped }];
  const firstOpen = all.findIndex((s) => !s.done);
  return all.map((s, i) => ({ label: s.label, state: s.done ? "done" : i === firstOpen ? "current" : "todo" }));
}

/** Items of the order that are in a sent (submitted) shipment. */
function sentItemIds(orderId: number): Set<number> {
  return new Set(
    db
      .select({ itemId: shipmentItems.itemId })
      .from(shipmentItems)
      .innerJoin(shipments, eq(shipmentItems.shipmentId, shipments.id))
      .where(and(eq(shipments.orderId, orderId), eq(shipments.status, "submitted")))
      .all()
      .map((r) => r.itemId),
  );
}

/** The progress bar of one item: Order received, each of its steps, Shipped. */
export function itemTrack(itemId: number): TrackStep[] {
  const item = db.select().from(orderItems).where(eq(orderItems.id, itemId)).get();
  if (!item) return [];
  const order = db.select({ status: orders.status }).from(orders).where(eq(orders.id, item.orderId)).get();
  const shipped = sentItemIds(item.orderId).has(itemId) || order?.status === "completed";
  return build(
    itemStageViews(itemId).map((s) => ({ label: s.label, done: s.status === "done" })),
    shipped,
  );
}

/**
 * The progress bar of a whole order. Steps with the same name on different items count as one step (done when every
 * item that has it has finished it). "Shipped" is done when every item has been sent.
 */
export function orderTrack(orderId: number): TrackStep[] {
  const order = db.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId)).get();
  const items = db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, orderId)).all();

  const byName = new Map<string, { label: string; done: boolean }>();
  for (const it of items) {
    for (const s of itemStageViews(it.id)) {
      const key = s.label.trim().toLowerCase();
      const seen = byName.get(key);
      byName.set(key, { label: seen?.label ?? s.label, done: (seen?.done ?? true) && s.status === "done" });
    }
  }

  const sent = sentItemIds(orderId);
  const shipped = order?.status === "completed" || (items.length > 0 && items.every((i) => sent.has(i.id)));
  const steps = [...byName.values()].map((s) => ({ ...s, done: s.done || order?.status === "completed" }));
  return build(steps, shipped);
}

export type StepGroup = {
  label: string;
  items: { itemId: number; itemLabel: string; stageKey: string; ready: boolean }[];
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Steps that are open (the one to do now) on two or more items of an order, by name. A master with a Sherwani, a
 * Kurta and Pants who is at "Embroidery" on all of them gets one group, so he can finish it once. `ready` is false for
 * an item that still needs an image or a field first (it would be skipped).
 */
export function openStepGroups(orderId: number): StepGroup[] {
  const items = db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.position)).all();
  const groups: StepGroup[] = [];
  for (const it of items) {
    for (const st of itemStageViews(it.id)) {
      if (st.status !== "open") continue;
      let g = groups.find((x) => same(x.label, st.label));
      if (!g) groups.push((g = { label: st.label, items: [] }));
      g.items.push({ itemId: it.id, itemLabel: it.label, stageKey: st.key, ready: st.photoOk && st.fieldsOk });
    }
  }
  return groups.filter((g) => g.items.length >= 2);
}

/**
 * The master finishes one step on every item of his order that is at it. Each item is checked by the same rules as
 * finishing it alone, so an item that still needs its image or fields is skipped, not forced.
 */
export function completeStepForAll(masterId: number, orderId: number, label: string) {
  const group = openStepGroups(orderId).find((g) => same(g.label, label));
  const done: string[] = [];
  const skipped: string[] = [];
  for (const it of group?.items ?? []) {
    const res = completeStage({ by: "master", masterId }, it.itemId, it.stageKey);
    (res.ok ? done : skipped).push(it.itemLabel);
  }
  return { done, skipped };
}

/**
 * Where an order is now, in one short phrase, for the Customers filter chips: the step it is at ("Embroidery"),
 * "Ready to ship" when every step is done, or "No steps set up" when its items have no steps. null when it is all done.
 */
export function orderStage(orderId: number): string | null {
  const track = orderTrack(orderId);
  if (track.length <= 2) return "No steps set up";
  const now = track.find((s) => s.state === "current");
  if (!now) return null;
  return now.label === "Shipped" ? "Ready to ship" : now.label;
}
