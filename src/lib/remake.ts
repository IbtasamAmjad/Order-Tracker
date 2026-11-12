import { and, asc, eq, inArray, isNull, min } from "drizzle-orm";
import { db } from "@/db";
import { itemStages, orderItems, orders, shipmentItems, shipments, stageEvents } from "@/db/schema";
import { addEvent } from "./history";

export type RemakeResult = { ok: true; count: number } | { ok: false; reason: "no-reason" | "no-items" | "not-found" | "cancelled" };

/**
 * The office sends some items of an order (one, several or all) back for a remake, for example a delivered shoe that was
 * wrong. For each chosen item the steps start again from the first one (what is filled in on the form stays), the old
 * shipment line is marked as returned so the item no longer counts as sent, and a "remade" line goes in the history with
 * the reason. The first step gets the reason as an instruction, so the master reads it under "From the office".
 * The order keeps its original due date, so it shows as late by itself. A completed or archived order becomes active
 * again and goes to the top of the list; items not chosen stay as they were. A cancelled order cannot be remade.
 */
export function remakeItems(orderId: number, itemIds: number[], reason: string): RemakeResult {
  const why = reason.trim().slice(0, 1000);
  if (!why) return { ok: false, reason: "no-reason" };
  return db.transaction((tx) => {
    const o = tx.select().from(orders).where(eq(orders.id, orderId)).get();
    if (!o) return { ok: false, reason: "not-found" } as const;
    if (o.status === "cancelled" || (o.status === "archived" && o.archivedFrom === "cancelled")) return { ok: false, reason: "cancelled" } as const;
    const chosen = itemIds.length ? tx.select().from(orderItems).where(and(eq(orderItems.orderId, orderId), inArray(orderItems.id, itemIds))).all() : [];
    if (chosen.length === 0) return { ok: false, reason: "no-items" } as const;

    const now = new Date();
    for (const item of chosen) {
      const steps = tx.select().from(itemStages).where(eq(itemStages.itemId, item.id)).orderBy(asc(itemStages.position)).all();
      steps.forEach((s, i) => {
        tx.update(itemStages)
          .set({ status: i === 0 ? "open" : "locked", completedAt: null, completedBy: null, startedAt: i === 0 ? now : null, ...(i === 0 ? { instruction: `Remake: ${why}` } : {}) })
          .where(eq(itemStages.id, s.id))
          .run();
      });
      // it is no longer sent (the old shipment stays in the record) and it leaves any cart it was waiting in
      const sent = tx.select({ id: shipments.id }).from(shipments).where(eq(shipments.status, "submitted")).all().map((x) => x.id);
      if (sent.length) tx.update(shipmentItems).set({ returnedAt: now }).where(and(eq(shipmentItems.itemId, item.id), inArray(shipmentItems.shipmentId, sent), isNull(shipmentItems.returnedAt))).run();
      const drafts = tx.select({ id: shipments.id }).from(shipments).where(eq(shipments.status, "draft")).all().map((x) => x.id);
      if (drafts.length) tx.delete(shipmentItems).where(and(eq(shipmentItems.itemId, item.id), inArray(shipmentItems.shipmentId, drafts))).run();
      tx.update(orderItems).set({ remadeAt: now }).where(eq(orderItems.id, item.id)).run();
      addEvent({ orderId, itemId: item.id, kind: "remade", by: "admin", text: why }, tx);
    }

    // the order is live again, on top of the list, and the master sees it as updated; the due date is not touched
    const top = tx.select({ p: min(orders.priorityPosition) }).from(orders).where(eq(orders.status, "active")).get();
    tx.update(orders)
      .set({ status: "active", closedAt: null, archivedFrom: null, priorityPosition: (top?.p ?? 1) - 1, movedUpAt: now, changedForMasterAt: now, updatedAt: now })
      .where(eq(orders.id, orderId))
      .run();
    return { ok: true, count: chosen.length } as const;
  });
}

/** How many times this item was sent back for a remake. */
export function remakeCount(itemId: number): number {
  return db.select({ id: stageEvents.id }).from(stageEvents).where(and(eq(stageEvents.itemId, itemId), eq(stageEvents.kind, "remade"))).all().length;
}
