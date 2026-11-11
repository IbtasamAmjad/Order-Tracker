import { eq } from "drizzle-orm";
import { db } from "@/db";
import { masters, orderMasters, orders, shipments, stageEvents } from "@/db/schema";
import { hashPin, newToken } from "./pin";

export function createMaster(input: { name: string; pin: string; whatsappNumber?: string }) {
  return db
    .insert(masters)
    .values({
      name: input.name,
      token: newToken(),
      pinHash: hashPin(input.pin),
      sessionSecret: newToken(),
      whatsappNumber: input.whatsappNumber || null,
    })
    .returning({ id: masters.id })
    .get().id;
}

export function listMasters() {
  return db.select().from(masters).orderBy(masters.name).all();
}

export function getMasterByToken(token: string) {
  return db.select().from(masters).where(eq(masters.token, token)).get();
}

/** Admin sets a new PIN. Logs the master out everywhere. */
export function setPin(id: number, pin: string) {
  db.update(masters).set({ pinHash: hashPin(pin), sessionSecret: newToken() }).where(eq(masters.id, id)).run();
}

/** Lost link: issue a new URL token. The old link stops working. */
export function reissueLink(id: number) {
  db.update(masters).set({ token: newToken(), sessionSecret: newToken() }).where(eq(masters.id, id)).run();
}

export function setActive(id: number, active: boolean) {
  db.update(masters).set({ active }).where(eq(masters.id, id)).run();
}

/** True when the master has never had any customer, shipment or history, so deleting him loses nothing. */
export function masterIsUnused(id: number): boolean {
  const used =
    db.select({ x: orders.id }).from(orders).where(eq(orders.masterId, id)).get() ||
    db.select({ x: orderMasters.orderId }).from(orderMasters).where(eq(orderMasters.masterId, id)).get() ||
    db.select({ x: shipments.id }).from(shipments).where(eq(shipments.masterId, id)).get() ||
    db.select({ x: stageEvents.id }).from(stageEvents).where(eq(stageEvents.masterId, id)).get();
  return !used;
}

/** Deletes a master who has no work at all. One with customers or history is refused (Deactivate him instead). */
export function deleteMaster(id: number): "deleted" | "has-work" {
  if (!masterIsUnused(id)) return "has-work";
  db.delete(masters).where(eq(masters.id, id)).run();
  return "deleted";
}
