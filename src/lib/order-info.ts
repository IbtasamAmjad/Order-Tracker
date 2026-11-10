import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { itemStatesOfOrder, itemStatesSummary } from "./item-search";
import type { OrderInfo } from "./whatsapp";

/** What a WhatsApp message tells the master about an order: the design, the Karigar due date and where each item stands. */
export function orderInfo(orderId: number): OrderInfo | undefined {
  const o = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!o) return undefined;
  const states = itemStatesOfOrder(orderId);
  return { design: o.designNumber, dueDate: o.karigarDueDate, items: states.map((s) => ({ label: s.label, state: s.state, stage: s.stage })), summary: itemStatesSummary(states) };
}
