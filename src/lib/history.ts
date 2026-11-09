import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { itemStages, masters, orderItems, orders, stageEvents, type EventKind } from "@/db/schema";
import { isAssigned } from "./assign";

type Tx = Pick<typeof db, "select" | "insert" | "update">;

export type NewEvent = {
  orderId: number;
  itemId?: number | null;
  stageKey?: string | null;
  kind: EventKind;
  by: "master" | "admin";
  masterId?: number | null;
  text?: string | null;
};

/** Write one line of the history. History lines are never changed or removed. */
export function addEvent(e: NewEvent, tx: Tx = db): void {
  tx.insert(stageEvents)
    .values({ orderId: e.orderId, itemId: e.itemId ?? null, stageKey: e.stageKey ?? null, kind: e.kind, by: e.by, masterId: e.masterId ?? null, text: e.text?.trim() || null })
    .run();
}

const MAX_NOTE = 1000;
const clean = (t: string) => t.trim().slice(0, MAX_NOTE);

export type NoteResult = { ok: true } | { ok: false; reason: "empty" | "not-found" };

/**
 * A note or comment on one step. The master can write one on a step of his own active order (not on a step that is
 * still locked); Admin can write one on any step.
 */
export function addStageNote(who: { by: "master"; masterId: number } | { by: "admin" }, itemId: number, stageKey: string, text: string): NoteResult {
  const body = clean(text);
  if (!body) return { ok: false, reason: "empty" };
  const item = db.select().from(orderItems).where(eq(orderItems.id, itemId)).get();
  const stage = db.select().from(itemStages).where(and(eq(itemStages.itemId, itemId), eq(itemStages.stageKey, stageKey))).get();
  const order = item ? db.select().from(orders).where(eq(orders.id, item.orderId)).get() : null;
  if (!item || !stage || !order) return { ok: false, reason: "not-found" };
  if (who.by === "master" && (!isAssigned(who.masterId, order.id) || order.status !== "active" || stage.status === "locked")) return { ok: false, reason: "not-found" };
  addEvent({ orderId: order.id, itemId, stageKey, kind: "note", by: who.by, masterId: who.by === "master" ? who.masterId : null, text: body });
  return { ok: true };
}

/** The office's instruction for one step of one customer's item. An empty text clears it. */
export function setInstruction(itemId: number, stageKey: string, text: string): boolean {
  const stage = db.select().from(itemStages).where(and(eq(itemStages.itemId, itemId), eq(itemStages.stageKey, stageKey))).get();
  const item = db.select().from(orderItems).where(eq(orderItems.id, itemId)).get();
  if (!stage || !item) return false;
  const body = clean(text) || null;
  if ((stage.instruction ?? null) === body) return true; // nothing changed
  db.transaction((tx) => {
    tx.update(itemStages).set({ instruction: body }).where(eq(itemStages.id, stage.id)).run();
    addEvent({ orderId: item.orderId, itemId, stageKey, kind: "instruction", by: "admin", text: body ?? "(instruction removed)" }, tx);
    tx.update(orders).set({ changedForMasterAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, item.orderId)).run(); // the master sees "Updated"
  });
  return true;
}

/** The master presses "I have seen this order". The first one counts; the history keeps who and when. */
export function confirmOrder(masterId: number, orderId: number): boolean {
  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order || order.status !== "active" || !isAssigned(masterId, orderId)) return false;
  if (order.confirmedAt) return true;
  db.transaction((tx) => {
    const now = new Date();
    tx.update(orders).set({ confirmedAt: now, confirmedBy: masterId, updatedAt: now }).where(eq(orders.id, orderId)).run();
    addEvent({ orderId, kind: "confirmed", by: "master", masterId }, tx);
  });
  return true;
}

export type HistoryLine = {
  id: number;
  at: Date;
  kind: EventKind;
  who: string; // "Naseem" or "The office"
  by: "master" | "admin";
  stageKey: string | null;
  stage: string | null; // the step's name
  item: string | null; // the item's name
  text: string | null;
};

/** Everything that happened on an order, newest first. */
export function orderHistory(orderId: number): HistoryLine[] {
  const rows = db.select().from(stageEvents).where(eq(stageEvents.orderId, orderId)).orderBy(desc(stageEvents.id)).all();
  const items = new Map(db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all().map((i) => [i.id, i]));
  const names = new Map(db.select({ id: masters.id, name: masters.name }).from(masters).all().map((m) => [m.id, m.name]));
  return rows.map((r) => {
    const item = r.itemId ? items.get(r.itemId) : undefined;
    return {
      id: r.id,
      at: r.createdAt,
      kind: r.kind,
      by: r.by,
      who: r.by === "admin" ? "The office" : (r.masterId ? names.get(r.masterId) : null) ?? "The master",
      stageKey: r.stageKey,
      stage: r.stageKey ? (item?.snapshot.stages?.find((s) => s.key === r.stageKey)?.label ?? r.stageKey) : null,
      item: item?.label ?? null,
      text: r.text,
    };
  });
}

/** The notes written on each step of an item, oldest first, by step key. */
export function stageNotes(itemId: number): Map<string, HistoryLine[]> {
  const item = db.select().from(orderItems).where(eq(orderItems.id, itemId)).get();
  if (!item) return new Map();
  const rows = db.select().from(stageEvents).where(and(eq(stageEvents.itemId, itemId), eq(stageEvents.kind, "note"))).orderBy(asc(stageEvents.id)).all();
  const names = new Map(db.select({ id: masters.id, name: masters.name }).from(masters).all().map((m) => [m.id, m.name]));
  const out = new Map<string, HistoryLine[]>();
  for (const r of rows) {
    if (!r.stageKey) continue;
    out.set(r.stageKey, [
      ...(out.get(r.stageKey) ?? []),
      {
        id: r.id,
        at: r.createdAt,
        kind: r.kind,
        by: r.by,
        who: r.by === "admin" ? "The office" : (r.masterId ? names.get(r.masterId) : null) ?? "The master",
        stageKey: r.stageKey,
        stage: item.snapshot.stages?.find((s) => s.key === r.stageKey)?.label ?? r.stageKey,
        item: item.label,
        text: r.text,
      },
    ]);
  }
  return out;
}

/** The step's instruction from the office, by step key, for one item. */
export function stageInstructions(itemId: number): Map<string, string> {
  return new Map(
    db
      .select({ key: itemStages.stageKey, instruction: itemStages.instruction })
      .from(itemStages)
      .where(eq(itemStages.itemId, itemId))
      .all()
      .filter((r): r is { key: string; instruction: string } => !!r.instruction)
      .map((r) => [r.key, r.instruction]),
  );
}

/** One line of the history in plain words, like "Naseem finished Embroidery". */
export function describeEvent(h: HistoryLine): string {
  const of = h.item && h.item !== h.stage ? ` (${h.item})` : "";
  switch (h.kind) {
    case "confirmed":
      return `${h.who} confirmed they have seen the order`;
    case "done":
      return `${h.who} finished ${h.stage ?? "a step"}${of}`;
    case "note":
      return `${h.who} added a note on ${h.stage ?? "a step"}${of}`;
    case "instruction":
      return `${h.who} left an instruction for ${h.stage ?? "a step"}${of}`;
    case "image":
      return `${h.who} added an image to ${h.stage ?? "a step"}${of}`;
    case "shipped":
      return `${h.who} sent ${h.item ?? "an item"}`;
  }
}
