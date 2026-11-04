import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, photos } from "@/db/schema";
import { requireMaster } from "@/lib/master-session";
import { storeUpload } from "@/lib/photo-upload";
import { addReferencePhoto } from "@/lib/stages";

const fail = (error: string, status = 400) => Response.json({ error }, { status });
const MAX_PER_FIELD = 10;

// The master adds a picture to a "picture" field that Admin marked "Me and the master".
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const master = await requireMaster(token);
  if (!master) return fail("Please open your link and enter your code again.", 401);

  const form = await req.formData();
  const file = form.get("file");
  const itemId = Number(form.get("itemId"));
  const fieldKey = String(form.get("fieldKey") ?? "");
  if (!(file instanceof File) || !itemId || !fieldKey) return fail("Missing photo.");

  const item = db.select().from(orderItems).where(eq(orderItems.id, itemId)).get();
  const order = item ? db.select().from(orders).where(eq(orders.id, item.orderId)).get() : null;
  if (!item || !order || order.masterId !== master.id) return fail("This item was not found.", 404);
  if (order.status !== "active") return fail("This order is closed.", 403);

  const field = item.snapshot.fields.find((f) => f.key === fieldKey);
  if (field?.type !== "picture" || !field.masterCanEdit) return fail("You cannot add pictures here.", 403);

  const have = db
    .select({ id: photos.id })
    .from(photos)
    .where(and(eq(photos.itemId, itemId), eq(photos.fieldKey, fieldKey), eq(photos.type, "reference")))
    .all().length;
  if (have >= MAX_PER_FIELD) return fail(`Only ${MAX_PER_FIELD} pictures here.`);

  const saved = await storeUpload(order.id, file);
  if ("error" in saved) return fail(saved.error);
  const id = addReferencePhoto({ orderId: order.id, itemId, fieldKey, uploadedBy: "master", ...saved });
  db.update(orders).set({ masterEditedAt: new Date() }).where(eq(orders.id, order.id)).run();
  return Response.json({ ok: true, id });
}
