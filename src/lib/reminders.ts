import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { itemStages, masters, orderItems, orders, photos, shipments } from "@/db/schema";
import { daysUntil } from "./colour";
import { REMINDER_DUE_DAYS, STALE_DAYS } from "./config";

const DAY = 86_400_000;

/** Last time anything moved on an order: created, a step finished, the master sent a photo, a shipment started. */
export function lastActivityAt(orderId: number): Date {
  const times: number[] = [];
  const o = db.select({ c: orders.createdAt }).from(orders).where(eq(orders.id, orderId)).get();
  if (o) times.push(o.c.getTime());
  for (const r of db
    .select({ t: itemStages.completedAt })
    .from(itemStages)
    .innerJoin(orderItems, eq(itemStages.itemId, orderItems.id))
    .where(eq(orderItems.orderId, orderId))
    .all())
    if (r.t) times.push(r.t.getTime());
  for (const r of db
    .select({ t: photos.uploadedAt })
    .from(photos)
    .where(and(eq(photos.orderId, orderId), eq(photos.uploadedBy, "master")))
    .all())
    times.push(r.t.getTime());
  for (const r of db.select({ t: shipments.createdAt }).from(shipments).where(eq(shipments.orderId, orderId)).all())
    times.push(r.t.getTime());
  return new Date(Math.max(...times));
}

export type Flags = {
  overdue: boolean;
  daysOverdue: number;
  dueSoon: boolean;
  daysLeft: number;
  stale: boolean;
  idleDays: number;
};

/** Overdue / due soon / no-update flags for an active order. */
export function orderFlags(karigarDueDate: string, lastActivity: Date, now: Date = new Date()): Flags {
  const daysLeft = daysUntil(karigarDueDate, now);
  const idleDays = Math.max(0, Math.floor((now.getTime() - lastActivity.getTime()) / DAY));
  return {
    overdue: daysLeft < 0,
    daysOverdue: Math.max(0, -daysLeft),
    dueSoon: daysLeft >= 0 && daysLeft <= REMINDER_DUE_DAYS,
    daysLeft,
    stale: idleDays >= STALE_DAYS,
    idleDays,
  };
}

export const needsReminder = (f: Flags) => f.overdue || f.dueSoon || f.stale;

export type Reminder = {
  orderId: number;
  orderNumber: number;
  customerName: string;
  masterName: string;
  reasons: string[];
};

/** Active orders that need a nudge, most urgent (earliest due date) first. */
export function remindersList(now: Date = new Date()): Reminder[] {
  const rows = db
    .select({ o: orders, m: masters })
    .from(orders)
    .innerJoin(masters, eq(orders.masterId, masters.id))
    .where(eq(orders.status, "active"))
    .all();

  const out: (Reminder & { due: string })[] = [];
  for (const { o, m } of rows) {
    const f = orderFlags(o.karigarDueDate, lastActivityAt(o.id), now);
    if (!needsReminder(f)) continue;
    const reasons: string[] = [];
    if (f.overdue) reasons.push(`Overdue by ${f.daysOverdue} day${f.daysOverdue === 1 ? "" : "s"}`);
    else if (f.dueSoon) reasons.push(f.daysLeft === 0 ? "Due today" : `Due in ${f.daysLeft} day${f.daysLeft === 1 ? "" : "s"}`);
    if (f.stale) reasons.push(`No update for ${f.idleDays} days`);
    out.push({
      orderId: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      masterName: m.name,
      reasons,
      due: o.karigarDueDate,
    });
  }
  return out.sort((a, b) => a.due.localeCompare(b.due)).map(({ due, ...r }) => (void due, r));
}
