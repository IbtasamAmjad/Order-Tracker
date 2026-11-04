import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { masters, orderItems, orders, photos, shipmentItems, shipments } from "@/db/schema";
import { isMasterTurn, itemStageViews } from "./stages";

// ---------------------------------------------------------------- items

export type ShipReadiness = { ready: boolean; blockers: string[] };

/**
 * An item may leave only after its work has been checked. For every step of the item:
 *  - a photo the master sent that is still waiting for Admin blocks it, until Admin decides;
 *  - a step with a required photo is satisfied the moment Admin approves that photo (the master does not
 *    have to press "Mark complete" as well), as long as every field Admin made mandatory is filled in;
 *  - any other step must be finished;
 *  - a rejected photo blocks until a new one is sent and approved
 *    (on a finished step a rejected optional photo no longer blocks, because the master can no longer upload there).
 * An item whose category has no steps has nothing to approve, so it is ready.
 * Each blocker says exactly what is missing.
 */
export function itemShipReadiness(itemId: number): ShipReadiness {
  const blockers: string[] = [];
  for (const st of itemStageViews(itemId)) {
    const photo = st.latestPhoto?.status;
    if (photo === "pending") {
      blockers.push(`${st.label}: the photo is waiting for approval`);
      continue;
    }
    if (st.status === "done") continue;

    const missing = st.requiredFields.filter((x) => !x.filled);
    if (missing.length > 0) {
      const names = missing.map((x) => (x.masterCanEdit ? x.label : `${x.label} (the office fills this in)`)).join(", ");
      blockers.push(`${st.label}: still to fill in: ${names}`);
    } else if (photo === "rejected") {
      blockers.push(`${st.label}: the photo was rejected, send a new one`);
    } else if (st.photo === "required" && photo !== "approved") {
      blockers.push(`${st.label}: a photo is needed and must be approved`);
    } else if (st.photo === "required" && photo === "approved") {
      // approved photo, nothing else missing: this step is satisfied
    } else {
      blockers.push(`${st.label}: not finished yet`);
    }
  }
  return { ready: blockers.length === 0, blockers };
}

/** Items of an order, each with the submitted shipment it already left in (or null). */
export function shippableItems(orderId: number) {
  const items = db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.position)).all();
  const sent = db
    .select({ itemId: shipmentItems.itemId, shipmentId: shipments.id, at: shipments.submittedAt })
    .from(shipmentItems)
    .innerJoin(shipments, eq(shipmentItems.shipmentId, shipments.id))
    .where(and(eq(shipments.orderId, orderId), eq(shipments.status, "submitted")))
    .all();
  return items.map((i) => {
    const s = sent.find((x) => x.itemId === i.id);
    const { ready, blockers } = s ? { ready: true, blockers: [] as string[] } : itemShipReadiness(i.id);
    return { id: i.id, label: i.label, shippedIn: s?.shipmentId ?? null, shippedAt: s?.at ?? null, ready, blockers };
  });
}

// ------------------------------------------------------------ shipments

function ownShipment(masterId: number, shipmentId: number) {
  const s = db.select().from(shipments).where(eq(shipments.id, shipmentId)).get();
  return s && s.masterId === masterId ? s : null;
}

/** Start a shipment for an order, or reuse the open draft. Only for the master's own, still active orders. */
export function startShipment(masterId: number, orderId: number): number | null {
  const o = db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.masterId, masterId))).get();
  if (!o || o.status !== "active") return null;
  const draft = db
    .select({ id: shipments.id })
    .from(shipments)
    .where(and(eq(shipments.orderId, orderId), eq(shipments.status, "draft")))
    .orderBy(desc(shipments.id))
    .get();
  if (draft) return draft.id;
  return db.insert(shipments).values({ orderId, masterId }).returning({ id: shipments.id }).get().id;
}

export type ShipmentView = {
  id: number;
  orderId: number;
  status: "draft" | "submitted";
  billPhotoId: number | null;
  packagePhotoId: number | null;
  submittedAt: Date | null;
  items: { itemId: number; label: string; checked: boolean }[];
};

export function shipmentView(shipmentId: number): ShipmentView | null {
  const s = db.select().from(shipments).where(eq(shipments.id, shipmentId)).get();
  if (!s) return null;
  const items = db
    .select({ itemId: shipmentItems.itemId, label: orderItems.label, checked: shipmentItems.checked })
    .from(shipmentItems)
    .innerJoin(orderItems, eq(shipmentItems.itemId, orderItems.id))
    .where(eq(shipmentItems.shipmentId, shipmentId))
    .orderBy(asc(orderItems.position))
    .all();
  return {
    id: s.id,
    orderId: s.orderId,
    status: s.status,
    billPhotoId: s.billPhotoId,
    packagePhotoId: s.packagePhotoId,
    submittedAt: s.submittedAt,
    items,
  };
}

export function masterShipment(masterId: number, shipmentId: number): ShipmentView | null {
  return ownShipment(masterId, shipmentId) ? shipmentView(shipmentId) : null;
}

export function orderShipments(orderId: number, status?: "draft" | "submitted") {
  return db
    .select()
    .from(shipments)
    .where(and(eq(shipments.orderId, orderId), status ? eq(shipments.status, status) : undefined))
    .orderBy(desc(shipments.id))
    .all()
    .map((s) => shipmentView(s.id)!);
}

/**
 * Save which items are in a draft shipment and which the master confirmed are physically there.
 * Items already in a submitted shipment, and items not yet approved for shipping, are ignored.
 */
export function saveShipmentItems(masterId: number, shipmentId: number, included: number[], checked: number[]): boolean {
  const s = ownShipment(masterId, shipmentId);
  if (!s || s.status !== "draft") return false;
  const free = new Set(shippableItems(s.orderId).filter((i) => i.shippedIn === null && i.ready).map((i) => i.id));
  db.transaction((tx) => {
    tx.delete(shipmentItems).where(eq(shipmentItems.shipmentId, shipmentId)).run();
    for (const itemId of new Set(included)) {
      if (!free.has(itemId)) continue;
      tx.insert(shipmentItems).values({ shipmentId, itemId, checked: checked.includes(itemId) }).run();
    }
  });
  return true;
}

// ---------------------------------------------------------------- photos

export function canUploadShipmentPhoto(masterId: number, shipmentId: number) {
  const s = ownShipment(masterId, shipmentId);
  return s && s.status === "draft" ? s : null;
}

/** Store a bill / package photo record and attach it to the draft shipment. A new upload replaces the old one. */
export function attachShipmentPhoto(
  shipment: { id: number; orderId: number },
  kind: "bill" | "package",
  file: { fileKey: string; thumbKey: string; bytes: number },
): number {
  const photoId = db
    .insert(photos)
    .values({ orderId: shipment.orderId, type: kind, uploadedBy: "master", status: "approved", ...file })
    .returning({ id: photos.id })
    .get().id;
  db.update(shipments)
    .set(kind === "bill" ? { billPhotoId: photoId } : { packagePhotoId: photoId })
    .where(eq(shipments.id, shipment.id))
    .run();
  return photoId;
}

// ---------------------------------------------------------------- submit

export type SubmitResult =
  | { ok: true; orderCompleted: boolean }
  | { ok: false; reason: "not-found" | "not-draft" | "no-items" | "not-ready" | "unchecked" | "no-bill" | "already-shipped" | "blocked" };

/** Which requirements are still missing for a draft (used to show the checklist). */
export function shipmentRequirements(v: ShipmentView) {
  return {
    hasItems: v.items.length > 0,
    allChecked: v.items.length > 0 && v.items.every((i) => i.checked),
    hasBill: v.billPhotoId !== null,
  };
}

/**
 * Submit = handed to the shipping company. Needs: at least one item, every chosen item approved for
 * shipping (steps finished, photos approved), every chosen item ticked as present, and the bill uploaded. An item can be in only one submitted shipment. The master can only
 * submit while it is his turn on the order (Admin can allow it). When every item of the order has
 * shipped, the order becomes completed.
 */
export function submitShipment(masterId: number, shipmentId: number): SubmitResult {
  return db.transaction((tx) => {
    const s = ownShipment(masterId, shipmentId);
    if (!s) return { ok: false, reason: "not-found" } as const;
    if (s.status !== "draft") return { ok: false, reason: "not-draft" } as const;
    const v = shipmentView(shipmentId)!;
    const req = shipmentRequirements(v);
    if (!req.hasItems) return { ok: false, reason: "no-items" } as const;
    if (v.items.some((i) => !itemShipReadiness(i.itemId).ready)) return { ok: false, reason: "not-ready" } as const;
    if (!req.allChecked) return { ok: false, reason: "unchecked" } as const;
    if (!req.hasBill) return { ok: false, reason: "no-bill" } as const;
    if (!isMasterTurn(masterId, s.orderId)) return { ok: false, reason: "blocked" } as const;

    const sent = new Set(shippableItems(s.orderId).filter((i) => i.shippedIn !== null).map((i) => i.id));
    if (v.items.some((i) => sent.has(i.itemId))) return { ok: false, reason: "already-shipped" } as const;

    const now = new Date();
    tx.update(shipments).set({ status: "submitted", submittedAt: now }).where(eq(shipments.id, shipmentId)).run();

    // completed when all items are in submitted shipments
    const all = shippableItems(s.orderId);
    const orderCompleted = all.length > 0 && all.every((i) => i.shippedIn !== null);
    if (orderCompleted) {
      tx.update(orders).set({ status: "completed", closedAt: now, updatedAt: now }).where(eq(orders.id, s.orderId)).run();
    }
    return { ok: true, orderCompleted } as const;
  });
}

// ---------------------------------------------------------------- admin

export function unseenShipmentCount(): number {
  return db
    .select({ id: shipments.id })
    .from(shipments)
    .where(and(eq(shipments.status, "submitted"), isNull(shipments.adminSeenAt)))
    .all().length;
}

export function submittedShipmentsForAdmin() {
  const rows = db
    .select({ s: shipments, orderNumber: orders.orderNumber, customerName: orders.customerName, masterName: masters.name })
    .from(shipments)
    .innerJoin(orders, eq(shipments.orderId, orders.id))
    .innerJoin(masters, eq(shipments.masterId, masters.id))
    .where(eq(shipments.status, "submitted"))
    .orderBy(desc(shipments.submittedAt))
    .all();
  return rows.map((r) => ({
    ...shipmentView(r.s.id)!,
    orderNumber: r.orderNumber,
    customerName: r.customerName,
    masterName: r.masterName,
    isNew: r.s.adminSeenAt === null,
  }));
}

export function markShipmentsSeen(ids: number[]) {
  if (ids.length === 0) return;
  db.update(shipments).set({ adminSeenAt: new Date() }).where(inArray(shipments.id, ids)).run();
}
