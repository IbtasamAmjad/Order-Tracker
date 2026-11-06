import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { masters, orderMasters, orders } from "@/db/schema";

type Tx = Pick<typeof db, "select" | "insert" | "delete">;

/** SQL condition: this master is one of the order's masters (the main one on the order, or one added to the list). */
export const mine = (masterId: number) =>
  or(
    eq(orders.masterId, masterId),
    sql`exists (select 1 from ${orderMasters} where ${orderMasters.orderId} = ${orders.id} and ${orderMasters.masterId} = ${masterId})`,
  )!;

/** Every master of an order: the main one first, then the others. */
export function assignedMasterIds(orderId: number, tx: Tx = db): number[] {
  const o = tx.select({ m: orders.masterId }).from(orders).where(eq(orders.id, orderId)).get();
  if (!o) return [];
  const extra = tx.select({ m: orderMasters.masterId }).from(orderMasters).where(eq(orderMasters.orderId, orderId)).all();
  return [...new Set([o.m, ...extra.map((e) => e.m)])];
}

export function isAssigned(masterId: number, orderId: number, tx: Tx = db): boolean {
  return assignedMasterIds(orderId, tx).includes(masterId);
}

/** Replace an order's master list. The first id stays the order's main master (the one the lists group it under). */
export function setAssignedMasters(tx: Tx, orderId: number, masterIds: number[]): void {
  tx.delete(orderMasters).where(eq(orderMasters.orderId, orderId)).run();
  for (const masterId of new Set(masterIds)) tx.insert(orderMasters).values({ orderId, masterId }).run();
}

/** Clean a submitted list: whole numbers only, no repeats. */
export const cleanMasterIds = (ids: unknown[]): number[] => [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))];

/** Names of an order's masters, for the admin lists. */
export function masterNames(orderId: number): string[] {
  return assignedMasterIds(orderId).map((id) => db.select({ n: masters.name }).from(masters).where(eq(masters.id, id)).get()?.n ?? "");
}
