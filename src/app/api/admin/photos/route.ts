import { isAdmin } from "@/lib/admin-auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems } from "@/db/schema";
import { storeUpload } from "@/lib/photo-upload";
import { addReferencePhoto } from "@/lib/stages";

const fail = (error: string, status = 400) => Response.json({ error }, { status });

// Admin uploads a reference picture for a "picture" field of an order item.
export async function POST(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Admin login needed." }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  const itemId = Number(form.get("itemId"));
  const fieldKey = String(form.get("fieldKey") ?? "");
  if (!(file instanceof File) || !itemId || !fieldKey) return fail("Missing photo.");

  const item = db.select().from(orderItems).where(eq(orderItems.id, itemId)).get();
  const field = item?.snapshot.fields.find((f) => f.key === fieldKey);
  if (!item || field?.type !== "picture") return fail("This item has no such picture field.", 404);

  const saved = await storeUpload(item.orderId, file);
  if ("error" in saved) return fail(saved.error);
  const id = addReferencePhoto({ orderId: item.orderId, itemId, fieldKey, ...saved });
  return Response.json({ ok: true, id });
}
