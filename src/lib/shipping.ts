import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { masters, orderItems, orders, photos, shipmentItems, shipments } from "@/db/schema";
import { itemStageViews } from "./stages";
import { mine } from "./assign";
import { addEvent } from "./history";

// ---------------------------------------------------------------- items

export type ShipReadiness = { ready: boolean; blockers: string[] };

/**
 * An item may leave only after its work has been checked. For every step of the item:
 *  - a photo the master sent for a step that needs a photo, still waiting for Admin, blocks it until Admin decides
 *    (an image on an optional step is never waiting for anyone);
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
    // only a step that needs a photo waits for Admin; an image added to an optional step is just for the office to see
    if (photo === "pending" && st.photo === "required") {
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
    .where(eq(shipments.status, "submitted"))
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

/** May this master send this order now? It must be one of his own orders and still active. There is no waiting for earlier orders. */
export function canMasterShip(masterId: number, orderId: number): boolean {
  const o = db.select().from(orders).where(and(eq(orders.id, orderId), mine(masterId))).get();
  return !!o && o.status === "active";
}

/**
 * The master's open shipment (his "cart"), if there is one. He has one cart at a time, and it can hold ready items from
 * all of his customers, so one bill covers them all. Looking never creates one.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function findDraft(masterId: number, _orderId?: number): ShipmentView | null {
  const d = db
    .select({ id: shipments.id })
    .from(shipments)
    .where(and(eq(shipments.masterId, masterId), eq(shipments.status, "draft")))
    .orderBy(desc(shipments.id))
    .get();
  return d ? shipmentView(d.id) : null;
}

/**
 * Start the master cart, or reuse the open one. The order given is only where the bill picture is filed; it must be one
 * of his own, still active orders.
 */
export function startShipment(masterId: number, orderId: number): number | null {
  const o = db.select().from(orders).where(and(eq(orders.id, orderId), mine(masterId))).get();
  if (!o || o.status !== "active") return null;
  const draft = db
    .select({ id: shipments.id })
    .from(shipments)
    .where(and(eq(shipments.masterId, masterId), eq(shipments.status, "draft")))
    .orderBy(desc(shipments.id))
    .get();
  if (draft) {
    // a shipment from the old one-order-at-a-time way can point at an order that is closed now: file it under this one
    const home = db.select().from(shipments).where(eq(shipments.id, draft.id)).get()!;
    const open = db.select({ id: orders.id }).from(orders).where(and(eq(orders.id, home.orderId), mine(masterId), eq(orders.status, "active"))).get();
    if (!open) db.update(shipments).set({ orderId }).where(eq(shipments.id, draft.id)).run();
    return draft.id;
  }
  return db.insert(shipments).values({ orderId, masterId }).returning({ id: shipments.id }).get().id;
}

/** Everything this master could put in the cart: ready items, not yet sent, from all his active orders. */
export function cartCandidates(masterId: number) {
  const list = db
    .select({ id: orders.id, orderNumber: orders.orderNumber, customerName: orders.customerName, designNumber: orders.designNumber })
    .from(orders)
    .where(and(mine(masterId), eq(orders.status, "active")))
    .orderBy(orders.orderNumber)
    .all();
  return list.flatMap((o) =>
    shippableItems(o.id)
      .filter((i) => i.shippedIn === null && i.ready)
      .map((i) => ({ itemId: i.id, label: i.label, orderId: o.id, orderNumber: o.orderNumber, customerName: o.customerName, designNumber: o.designNumber })),
  );
}

/** Put one ready item of the master into his cart (made if needed). False if it cannot go. */
export function addToCart(masterId: number, itemId: number): boolean {
  const c = cartCandidates(masterId).find((x) => x.itemId === itemId);
  if (!c) return false;
  const sid = startShipment(masterId, c.orderId);
  if (!sid) return false;
  const has = db.select({ id: shipmentItems.id }).from(shipmentItems).where(and(eq(shipmentItems.shipmentId, sid), eq(shipmentItems.itemId, itemId))).get();
  if (!has) db.insert(shipmentItems).values({ shipmentId: sid, itemId, checked: true }).run();
  return true;
}

/** Take an item out of the master open cart. */
export function removeFromCart(masterId: number, itemId: number): boolean {
  const d = findDraft(masterId);
  if (!d) return false;
  db.delete(shipmentItems).where(and(eq(shipmentItems.shipmentId, d.id), eq(shipmentItems.itemId, itemId))).run();
  return true;
}

export type ShipmentView = {
  id: number;
  orderId: number;
  status: "draft" | "submitted";
  billPhotoId: number | null;
  packagePhotoId: number | null;
  submittedAt: Date | null;
  items: { itemId: number; label: string; checked: boolean; orderId: number; orderNumber: number; customerName: string; designNumber: string | null }[];
};

export function shipmentView(shipmentId: number): ShipmentView | null {
  const s = db.select().from(shipments).where(eq(shipments.id, shipmentId)).get();
  if (!s) return null;
  const items = db
    .select({
      itemId: shipmentItems.itemId,
      label: orderItems.label,
      checked: shipmentItems.checked,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      designNumber: orders.designNumber,
    })
    .from(shipmentItems)
    .innerJoin(orderItems, eq(shipmentItems.itemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(shipmentItems.shipmentId, shipmentId))
    .orderBy(asc(orders.orderNumber), asc(orderItems.position))
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
  const ids = new Set(
    db
      .select({ id: shipments.id })
      .from(shipments)
      .innerJoin(shipmentItems, eq(shipmentItems.shipmentId, shipments.id))
      .innerJoin(orderItems, eq(shipmentItems.itemId, orderItems.id))
      .where(and(eq(orderItems.orderId, orderId), status ? eq(shipments.status, status) : undefined))
      .all()
      .map((r) => r.id),
  );
  return [...ids]
    .sort((a, b) => b - a)
    .map((id) => shipmentView(id)!)
    .map((v) => ({ ...v, items: v.items.filter((i) => i.orderId === orderId) }));
}

/**
 * Save which items are in a draft shipment and which the master confirmed are physically there.
 * Items already in a submitted shipment, and items not yet approved for shipping, are ignored.
 */
export function saveShipmentItems(masterId: number, shipmentId: number, included: number[], checked: number[]): boolean {
  const s = ownShipment(masterId, shipmentId);
  if (!s || s.status !== "draft") return false;
  const free = new Set(cartCandidates(masterId).map((i) => i.itemId));
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
 * submit while it is his turn on the order (Admin can allow it; see canMasterShip). When every item of the order has
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
    const orderIds = [...new Set(v.items.map((i) => i.orderId))];
    if (orderIds.some((oid) => !canMasterShip(masterId, oid))) return { ok: false, reason: "blocked" } as const;

    for (const oid of orderIds) {
      const sent = new Set(shippableItems(oid).filter((i) => i.shippedIn !== null).map((i) => i.id));
      if (v.items.some((i) => i.orderId === oid && sent.has(i.itemId))) return { ok: false, reason: "already-shipped" } as const;
    }

    const now = new Date();
    tx.update(shipments).set({ status: "submitted", submittedAt: now }).where(eq(shipments.id, shipmentId)).run();
    for (const it of v.items) addEvent({ orderId: it.orderId, itemId: it.itemId, kind: "shipped", by: "master", masterId }, tx);

    // an order is completed when all its items are in submitted shipments
    let orderCompleted = false;
    for (const oid of orderIds) {
      const all = shippableItems(oid);
      if (all.length > 0 && all.every((i) => i.shippedIn !== null)) {
        tx.update(orders).set({ status: "completed", closedAt: now, updatedAt: now }).where(eq(orders.id, oid)).run();
        orderCompleted = true;
      }
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
    .select({ s: shipments, masterName: masters.name })
    .from(shipments)
    .innerJoin(masters, eq(shipments.masterId, masters.id))
    .where(eq(shipments.status, "submitted"))
    .orderBy(desc(shipments.submittedAt))
    .all();
  return rows.map((r) => ({
    ...shipmentView(r.s.id)!,
    masterName: r.masterName,
    isNew: r.s.adminSeenAt === null,
  }));
}

export function markShipmentsSeen(ids: number[]) {
  if (ids.length === 0) return;
  db.update(shipments).set({ adminSeenAt: new Date() }).where(inArray(shipments.id, ids)).run();
}
