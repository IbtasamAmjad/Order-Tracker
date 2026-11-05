import { and, asc, desc, eq, gt, inArray, lt, max } from "drizzle-orm";
import { db } from "@/db";
import { masters, orderItems, orders, shipmentItems, shipments, type OrderStatus } from "@/db/schema";
import { cleanValues, isTextEditable, type ItemValues, type NewItem } from "./items";
import { createStageRows, orderProgress } from "./stages";
import { lastActivityAt, orderFlags } from "./reminders";
import { colourBand, type Band } from "./colour";
import { CLOSED_VISIBLE_DAYS } from "./config";

export type OrderInput = {
  customerName: string;
  myDueDate: string;
  karigarDueDate: string;
  masterId: number;
  details: string;
};

// ---------------------------------------------------------------- admin

export function createOrder(input: OrderInput, items: NewItem[] = []): number {
  return db.transaction((tx) => {
    const row = tx
      .select({ n: max(orders.orderNumber), p: max(orders.priorityPosition) })
      .from(orders)
      .get();
    const res = tx
      .insert(orders)
      .values({
        ...input,
        orderNumber: (row?.n ?? 0) + 1,
        priorityPosition: (row?.p ?? 0) + 1, // joins the end of the sequence
      })
      .returning({ id: orders.id })
      .get();
    items.forEach((it, i) => {
      const itemId = tx
        .insert(orderItems)
        .values({ orderId: res.id, ...it, position: i + 1 })
        .returning({ id: orderItems.id })
        .get().id;
      createStageRows(tx, itemId, it.snapshot.stages ?? []);
    });
    return res.id;
  });
}

/** itemValues: new values per existing item id. */
export function updateOrder(id: number, input: OrderInput, itemValues: Map<number, ItemValues> = new Map()): void {
  db.transaction((tx) => {
    const old = tx.select().from(orders).where(eq(orders.id, id)).get();
    if (!old) return;
    const now = new Date();
    const masterChanged = old.masterId !== input.masterId;
    let itemsChanged = false;
    for (const [itemId, values] of itemValues) {
      const item = tx.select().from(orderItems).where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, id))).get();
      if (!item) continue;
      if (JSON.stringify(item.values) !== JSON.stringify(values)) {
        itemsChanged = true;
        tx.update(orderItems).set({ values }).where(eq(orderItems.id, itemId)).run();
      }
    }
    const visibleChange =
      masterChanged ||
      itemsChanged ||
      old.customerName !== input.customerName ||
      old.karigarDueDate !== input.karigarDueDate ||
      old.details !== input.details;
    tx.update(orders)
      .set({
        ...input,
        updatedAt: now,
        ...(visibleChange ? { changedForMasterAt: now } : {}),
        // a newly assigned master sees it as New
        ...(masterChanged ? { masterSeenAt: null, masterLastSeenAt: null } : {}),
      })
      .where(eq(orders.id, id))
      .run();
  });
}

/** Move an order up/down among the same master's active orders. */
export function moveOrder(id: number, dir: "up" | "down"): void {
  db.transaction((tx) => {
    const o = tx.select().from(orders).where(eq(orders.id, id)).get();
    if (!o || o.status !== "active") return;
    const mine = and(
      eq(orders.masterId, o.masterId),
      eq(orders.status, "active"),
    );
    const neighbour = tx
      .select()
      .from(orders)
      .where(
        and(
          mine,
          dir === "up"
            ? lt(orders.priorityPosition, o.priorityPosition)
            : gt(orders.priorityPosition, o.priorityPosition),
        ),
      )
      .orderBy(dir === "up" ? desc(orders.priorityPosition) : asc(orders.priorityPosition))
      .limit(1)
      .get();
    if (!neighbour) return;
    const now = new Date();
    const raised = dir === "up" ? o : neighbour;
    tx.update(orders).set({ priorityPosition: neighbour.priorityPosition }).where(eq(orders.id, o.id)).run();
    tx.update(orders).set({ priorityPosition: o.priorityPosition }).where(eq(orders.id, neighbour.id)).run();
    tx.update(orders).set({ movedUpAt: now }).where(eq(orders.id, raised.id)).run();
  });
}

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  active: ["completed", "cancelled"],
  completed: ["archived"],
  cancelled: ["archived"],
  archived: [],
};

/** Status changes. No hard delete: orders are completed/cancelled, then archived. */
export function setStatus(id: number, status: OrderStatus): boolean {
  const o = db.select().from(orders).where(eq(orders.id, id)).get();
  if (!o || !ALLOWED[o.status].includes(status)) return false;
  const now = new Date();
  db.update(orders)
    .set({
      status,
      updatedAt: now,
      ...(status === "archived"
        ? { archivedFrom: o.status === "cancelled" ? ("cancelled" as const) : ("completed" as const) }
        : { closedAt: now, changedForMasterAt: now }),
    })
    .where(eq(orders.id, id))
    .run();
  return true;
}

export function setAllowOutOfSequence(id: number, allow: boolean): void {
  db.update(orders)
    .set({ allowOutOfSequence: allow, updatedAt: new Date() })
    .where(eq(orders.id, id))
    .run();
}

export function getOrder(id: number) {
  return db.select().from(orders).where(eq(orders.id, id)).get();
}

/** id of each master's first (most urgent) active order. */
function firstActiveByMaster(): Map<number, number> {
  const rows = db
    .select({ id: orders.id, masterId: orders.masterId })
    .from(orders)
    .where(eq(orders.status, "active"))
    .orderBy(asc(orders.priorityPosition))
    .all();
  const first = new Map<number, number>();
  for (const r of rows) if (!first.has(r.masterId)) first.set(r.masterId, r.id);
  return first;
}

/**
 * The admin's lists: the live orders; the finished ones (completed or cancelled, not yet put away);
 * and the archive (put away, like WhatsApp's Archived chats: out of the main list but kept).
 */
export function listAdminOrders(opts: { masterId?: number; view: "active" | "finished" | "archived" }) {
  const first = firstActiveByMaster();
  const rows = db
    .select({ order: orders, masterName: masters.name })
    .from(orders)
    .innerJoin(masters, eq(orders.masterId, masters.id))
    .where(
      and(
        opts.view === "active"
          ? eq(orders.status, "active")
          : opts.view === "archived"
            ? eq(orders.status, "archived")
            : inArray(orders.status, ["completed", "cancelled"]),
        opts.masterId ? eq(orders.masterId, opts.masterId) : undefined,
      ),
    )
    .orderBy(opts.view === "active" ? asc(orders.priorityPosition) : desc(orders.closedAt))
    .all();
  return rows.map(({ order, masterName }) => ({
    ...order,
    masterName,
    flags: order.status === "active" ? orderFlags(order.karigarDueDate, lastActivityAt(order.id)) : null,
    band: (order.status === "active"
      ? colourBand(order.karigarDueDate, first.get(order.masterId) === order.id)
      : null) as Band | null,
  }));
}

// --------------------------------------------------------------- master
// Master queries select explicit columns so "My due date" can never leak.

const masterColumns = {
  id: orders.id,
  orderNumber: orders.orderNumber,
  customerName: orders.customerName,
  karigarDueDate: orders.karigarDueDate,
  details: orders.details,
  status: orders.status,
  allowOutOfSequence: orders.allowOutOfSequence,
  masterSeenAt: orders.masterSeenAt,
  masterLastSeenAt: orders.masterLastSeenAt,
  changedForMasterAt: orders.changedForMasterAt,
  movedUpAt: orders.movedUpAt,
  closedAt: orders.closedAt,
};

export type Badge = "New" | "Updated" | "Moved up";

function badgeFor(o: {
  masterSeenAt: Date | null;
  masterLastSeenAt: Date | null;
  changedForMasterAt: Date | null;
  movedUpAt: Date | null;
}): Badge | null {
  if (!o.masterSeenAt) return "New";
  const seen = o.masterLastSeenAt?.getTime() ?? 0;
  if (o.movedUpAt && o.movedUpAt.getTime() > seen) return "Moved up";
  if (o.changedForMasterAt && o.changedForMasterAt.getTime() > seen) return "Updated";
  return null;
}

function closedCutoff(now: Date) {
  return new Date(now.getTime() - CLOSED_VISIBLE_DAYS * 86_400_000);
}

export function masterDashboard(masterId: number, now = new Date()) {
  const rows = db
    .select(masterColumns)
    .from(orders)
    .where(and(eq(orders.masterId, masterId), inArray(orders.status, ["active", "completed", "cancelled"])))
    .orderBy(asc(orders.priorityPosition))
    .all();
  const active = rows
    .filter((r) => r.status === "active")
    .map((r, i) => ({
      ...r,
      badge: badgeFor(r),
      band: colourBand(r.karigarDueDate, i === 0, now),
      progress: orderProgress(r.id),
      flags: orderFlags(r.karigarDueDate, lastActivityAt(r.id), now),
    }));
  const cutoff = closedCutoff(now).getTime();
  const closed = rows
    .filter((r) => r.status !== "active" && (r.closedAt?.getTime() ?? 0) >= cutoff)
    .sort((a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0));
  return { active, closed };
}

/** One order for a master. Returns null if it isn't theirs or is hidden. */
export function masterOrder(masterId: number, orderId: number, now = new Date()) {
  const o = db
    .select(masterColumns)
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.masterId, masterId)))
    .get();
  if (!o || o.status === "archived") return null;
  if (o.status !== "active" && (o.closedAt?.getTime() ?? 0) < closedCutoff(now).getTime()) return null;
  const firstId = db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.masterId, masterId), eq(orders.status, "active")))
    .orderBy(asc(orders.priorityPosition))
    .limit(1)
    .get()?.id;
  const canComplete = o.status === "active" && (o.id === firstId || o.allowOutOfSequence);
  return { ...o, canComplete, badge: badgeFor(o) };
}

export function markSeen(masterId: number, orderId: number): void {
  const now = new Date();
  const o = db
    .select({ seen: orders.masterSeenAt })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.masterId, masterId)))
    .get();
  if (!o) return;
  db.update(orders)
    .set({ masterSeenAt: o.seen ?? now, masterLastSeenAt: now })
    .where(and(eq(orders.id, orderId), eq(orders.masterId, masterId)))
    .run();
}

export type CompleteResult = { ok: true } | { ok: false; reason: "not-found" | "not-active" | "not-shipped" | "blocked" };

/**
 * Master marks an order complete. An order that has items is completed by shipping them, so this only works once
 * every item has been sent (an order with no items has nothing to ship). It never skips approval or shipping.
 * Blocked while an earlier order is unfinished, unless Admin allowed it.
 */
export function masterComplete(masterId: number, orderId: number): CompleteResult {
  return db.transaction((tx) => {
    const o = tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.masterId, masterId)))
      .get();
    if (!o) return { ok: false, reason: "not-found" } as const;
    if (o.status !== "active") return { ok: false, reason: "not-active" } as const;

    const items = tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, o.id)).all();
    if (items.length > 0) {
      const sent = new Set(
        tx
          .select({ itemId: shipmentItems.itemId })
          .from(shipmentItems)
          .innerJoin(shipments, eq(shipmentItems.shipmentId, shipments.id))
          .where(and(eq(shipments.orderId, o.id), eq(shipments.status, "submitted")))
          .all()
          .map((r) => r.itemId),
      );
      if (items.some((i) => !sent.has(i.id))) return { ok: false, reason: "not-shipped" } as const;
    }

    const first = tx
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.masterId, masterId), eq(orders.status, "active")))
      .orderBy(asc(orders.priorityPosition))
      .limit(1)
      .get();
    if (first?.id !== o.id && !o.allowOutOfSequence) return { ok: false, reason: "blocked" } as const;
    const now = new Date();
    tx.update(orders).set({ status: "completed", closedAt: now, updatedAt: now }).where(eq(orders.id, o.id)).run();
    return { ok: true } as const;
  });
}

// ---------------------------------------------------------------- items

export function listItems(orderId: number) {
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.position)).all();
}

/** Admin adds one more item to an existing order. */
export function addItem(orderId: number, item: NewItem): void {
  db.transaction((tx) => {
    const last = tx.select({ p: max(orderItems.position) }).from(orderItems).where(eq(orderItems.orderId, orderId)).get();
    const itemId = tx
      .insert(orderItems)
      .values({ orderId, ...item, position: (last?.p ?? 0) + 1 })
      .returning({ id: orderItems.id })
      .get().id;
    createStageRows(tx, itemId, item.snapshot.stages ?? []);
    tx.update(orders).set({ changedForMasterAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, orderId)).run();
  });
}

/** Items for the master. Only call after masterOrder() confirmed the order is theirs. */
export function masterItems(orderId: number) {
  return listItems(orderId).map((i) => ({ id: i.id, label: i.label, snapshot: i.snapshot, values: i.values }));
}

/**
 * The master fills the fields Admin marked "Me and the master" (comments, choices, numbers...).
 * Only those fields can change, and only on his own active orders. Pictures are uploaded separately.
 */
export function masterSaveFields(masterId: number, orderId: number, itemId: number, raw: Record<string, string>): boolean {
  return db.transaction((tx) => {
    const order = tx.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.masterId, masterId))).get();
    if (!order || order.status !== "active") return false;
    const item = tx.select().from(orderItems).where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId))).get();
    if (!item) return false;

    const editable = item.snapshot.fields.filter(isTextEditable);
    const cleaned = cleanValues(editable, raw);
    const values = { ...item.values };
    for (const f of editable) {
      if (cleaned[f.key] !== undefined) values[f.key] = cleaned[f.key];
      else delete values[f.key];
    }
    if (JSON.stringify(values) === JSON.stringify(item.values)) return true;
    tx.update(orderItems).set({ values }).where(eq(orderItems.id, itemId)).run();
    tx.update(orders).set({ masterEditedAt: new Date() }).where(eq(orders.id, orderId)).run();
    return true;
  });
}

/** How many orders are in each of the two closed lists (for the tabs). */
export function closedCounts(): { finished: number; archived: number } {
  const count = (statuses: OrderStatus[]) =>
    db.select({ id: orders.id }).from(orders).where(inArray(orders.status, statuses)).all().length;
  return { finished: count(["completed", "cancelled"]), archived: count(["archived"]) };
}

/**
 * Take an order out of the archive, back to the list it came from (completed or cancelled).
 * An order archived before that was written down is worked out: if something was never sent it was cancelled.
 */
export function unarchiveOrder(id: number): "completed" | "cancelled" | null {
  const o = db.select().from(orders).where(eq(orders.id, id)).get();
  if (!o || o.status !== "archived") return null;
  let back = o.archivedFrom;
  if (!back) {
    const items = db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, id)).all();
    const sent = new Set(
      db
        .select({ itemId: shipmentItems.itemId })
        .from(shipmentItems)
        .innerJoin(shipments, eq(shipmentItems.shipmentId, shipments.id))
        .where(and(eq(shipments.orderId, id), eq(shipments.status, "submitted")))
        .all()
        .map((r) => r.itemId),
    );
    back = items.some((i) => !sent.has(i.id)) ? "cancelled" : "completed";
  }
  const now = new Date();
  db.update(orders).set({ status: back, archivedFrom: null, updatedAt: now, changedForMasterAt: now }).where(eq(orders.id, id)).run();
  return back;
}
