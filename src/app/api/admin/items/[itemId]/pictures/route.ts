import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { photosZipResponse } from "@/lib/photo-download";
import { getPhoto, referencePhotos } from "@/lib/stages";

// Admin downloads the pictures of one item in a single ZIP file. ?ids=1,2,3 picks some of them; without it, all of them.
export async function GET(req: Request, ctx: { params: Promise<{ itemId: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "Admin login needed." }, { status: 401 });
  const { itemId } = await ctx.params;

  const item = db.select().from(orderItems).where(eq(orderItems.id, Number(itemId))).get();
  const order = item ? db.select().from(orders).where(eq(orders.id, item.orderId)).get() : null;
  if (!item || !order) return new Response("Not found", { status: 404 });

  const wanted = new Set(
    (new URL(req.url).searchParams.get("ids") ?? "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0),
  );
  const list = referencePhotos(item.id)
    .filter((r) => wanted.size === 0 || wanted.has(r.id))
    .map((r) => getPhoto(r.id))
    .filter((p): p is NonNullable<typeof p> => !!p);
  if (list.length === 0) return new Response("Not found", { status: 404 });

  return photosZipResponse(list, `order-${order.orderNumber}-${item.label}-pictures.zip`);
}
