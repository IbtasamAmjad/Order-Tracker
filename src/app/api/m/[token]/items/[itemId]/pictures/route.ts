import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { requireMaster } from "@/lib/master-session";
import { photosZipResponse } from "@/lib/photo-download";
import { photoForMaster, referencePhotos } from "@/lib/stages";

// The master downloads every picture of one item in a single ZIP file.
export async function GET(_req: Request, ctx: { params: Promise<{ token: string; itemId: string }> }) {
  const { token, itemId } = await ctx.params;
  const master = await requireMaster(token);
  if (!master) return new Response("Not found", { status: 404 });

  const item = db.select().from(orderItems).where(eq(orderItems.id, Number(itemId))).get();
  const order = item ? db.select().from(orders).where(eq(orders.id, item.orderId)).get() : null;
  if (!item || !order) return new Response("Not found", { status: 404 });

  // only pictures this master may see (his own, visible orders)
  const mine = referencePhotos(item.id)
    .map((r) => photoForMaster(master.id, r.id))
    .filter((p): p is NonNullable<typeof p> => !!p);
  if (mine.length === 0) return new Response("Not found", { status: 404 });

  return photosZipResponse(mine, `order-${order.orderNumber}-${item.label}-pictures.zip`);
}
