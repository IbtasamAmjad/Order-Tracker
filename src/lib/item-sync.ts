import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { itemStages, orderItems, orders, type ItemSnapshot } from "@/db/schema";
import { templateForItem } from "./templates";
import { withAutoValues } from "./items";

/**
 * An order keeps its own copy of its category's form and steps, so editing the category never changes it.
 * This tells whether the category has changed since the item was added (fields or steps differ).
 */
export function categoryDiffers(item: { templateId: number | null; snapshot: ItemSnapshot }): boolean {
  if (!item.templateId) return false;
  const tpl = templateForItem(item.templateId);
  if (!tpl) return false;
  return JSON.stringify([item.snapshot.fields, item.snapshot.stages ?? []]) !== JSON.stringify([tpl.snapshot.fields, tpl.snapshot.stages]);
}

export type RefreshResult = "ok" | "no-category" | "closed" | "not-found";

/**
 * Copy the category's current form and steps into one item. Everything already filled in stays (values are
 * kept by field key), finished steps stay finished, new steps are added after them, removed steps go.
 * Exactly the first unfinished step is open, so the order moves on from where it was.
 */
export function refreshItemFromCategory(itemId: number): RefreshResult {
  return db.transaction((tx) => {
    const item = tx.select().from(orderItems).where(eq(orderItems.id, itemId)).get();
    if (!item) return "not-found";
    const order = tx.select().from(orders).where(eq(orders.id, item.orderId)).get();
    if (!order || order.status !== "active") return "closed";
    if (!item.templateId) return "no-category";
    const tpl = templateForItem(item.templateId);
    if (!tpl) return "no-category";

    tx.update(orderItems).set({ snapshot: tpl.snapshot, values: withAutoValues(tpl.snapshot.fields, item.values, order) }).where(eq(orderItems.id, itemId)).run();

    const defs = tpl.snapshot.stages;
    const rows = tx.select().from(itemStages).where(eq(itemStages.itemId, itemId)).orderBy(asc(itemStages.position)).all();
    for (const r of rows) {
      if (!defs.some((d) => d.key === r.stageKey)) tx.delete(itemStages).where(eq(itemStages.id, r.id)).run();
    }
    defs.forEach((d, i) => {
      const existing = rows.find((r) => r.stageKey === d.key);
      if (existing) tx.update(itemStages).set({ position: i + 1 }).where(eq(itemStages.id, existing.id)).run();
      else tx.insert(itemStages).values({ itemId, stageKey: d.key, position: i + 1, status: "locked" }).run();
    });

    const now = tx.select().from(itemStages).where(eq(itemStages.itemId, itemId)).orderBy(asc(itemStages.position)).all();
    let opened = false;
    for (const r of now) {
      if (r.status === "done") continue;
      const status = opened ? "locked" : "open";
      opened = true;
      if (r.status !== status) tx.update(itemStages).set({ status, ...(status === "open" ? { startedAt: new Date() } : {}) }).where(and(eq(itemStages.id, r.id))).run();
    }

    const at = new Date();
    tx.update(orders).set({ updatedAt: at, changedForMasterAt: at }).where(eq(orders.id, order.id)).run();
    return "ok";
  });
}

/**
 * Bring the items of ACTIVE customers up to date with their item's current form and steps, so nobody has to press
 * "Update from the item". Only items that really differ are touched; what is filled in stays, finished steps stay
 * finished, and the master sees the customer as updated. Finished, cancelled and archived customers are left alone.
 * `templateId` limits it to one item type, `orderId` to one customer. Returns how many items were updated.
 */
export function syncActiveItems(only: { templateId?: number; orderId?: number } = {}): number {
  const rows = db
    .select({ item: orderItems })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.status, "active"), only.templateId ? eq(orderItems.templateId, only.templateId) : undefined, only.orderId ? eq(orderItems.orderId, only.orderId) : undefined))
    .all();
  let n = 0;
  for (const { item } of rows) if (categoryDiffers(item) && refreshItemFromCategory(item.id) === "ok") n++;
  return n;
}
