import { eq } from "drizzle-orm";
import { db } from "@/db";
import { masters, orderItems, orders, photos } from "@/db/schema";
import { messages, waLink } from "./whatsapp";
import { assignedMasterIds } from "./assign";

export type Notice = { masterName: string; hasNumber: boolean; link: string; label: string };

export type OrderNoticeKind = "new" | "movedUp" | "updated" | "cancelled";

const LABEL: Record<OrderNoticeKind, string> = {
  new: "Tell the master about this new order",
  movedUp: "Tell the master this order is more urgent",
  updated: "Tell the master this order was changed",
  cancelled: "Tell the master this order is cancelled",
};

/** A ready-to-tap WhatsApp message for each master of an order (one button per master). */
export function orderNotices(kind: OrderNoticeKind, orderId: number): Notice[] {
  if (!(kind in LABEL)) return []; // kind can come from the URL
  const o = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!o) return [];
  const out: Notice[] = [];
  for (const masterId of assignedMasterIds(orderId)) {
    const m = db.select().from(masters).where(eq(masters.id, masterId)).get();
    if (!m) continue;
    const c = { masterName: m.name, token: m.token, orderNumber: o.orderNumber, customer: o.customerName };
    const text =
      kind === "new"
        ? messages.newOrder({ ...c, karigarDue: o.karigarDueDate })
        : kind === "movedUp"
          ? messages.movedUp(c)
          : kind === "updated"
            ? messages.updated(c)
            : messages.cancelled(c);
    out.push({ masterName: m.name, hasNumber: !!m.whatsappNumber, link: waLink(m.whatsappNumber, text), label: LABEL[kind] });
  }
  return out;
}

/** The result of a photo review (approved / rejected), as a WhatsApp message to the master. */
export function photoNotice(photoId: number): Notice | null {
  const row = db
    .select({ p: photos, o: orders, m: masters, item: orderItems })
    .from(photos)
    .innerJoin(orders, eq(photos.orderId, orders.id))
    .innerJoin(masters, eq(orders.masterId, masters.id))
    .innerJoin(orderItems, eq(photos.itemId, orderItems.id))
    .where(eq(photos.id, photoId))
    .get();
  if (!row || row.p.status === "pending") return null;
  const stage = row.item.snapshot.stages?.find((s) => s.key === row.p.stageKey)?.label ?? row.p.stageKey ?? "";
  const c = {
    masterName: row.m.name,
    token: row.m.token,
    orderNumber: row.o.orderNumber,
    customer: row.o.customerName,
    what: `${row.item.label} - ${stage}`,
  };
  const approved = row.p.status === "approved";
  const text = approved ? messages.photoApproved(c) : messages.photoRejected({ ...c, comment: row.p.comment ?? "please try again" });
  return {
    masterName: row.m.name,
    hasNumber: !!row.m.whatsappNumber,
    link: waLink(row.m.whatsappNumber, text),
    label: approved ? "Tell the master the photo is approved" : "Tell the master the photo was rejected",
  };
}
