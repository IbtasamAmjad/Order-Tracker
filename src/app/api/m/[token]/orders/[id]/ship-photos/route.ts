import { requireMaster } from "@/lib/master-session";
import { storeUpload } from "@/lib/photo-upload";
import { attachShipmentPhoto, canUploadShipmentPhoto, startShipment } from "@/lib/shipping";

const fail = (error: string, status = 400) => Response.json({ error }, { status });

// The master adds the bill (or an optional photo of the packed items) for an order's open shipment.
// The shipment is made here the first time a photo is added, so just looking at the shipping page makes nothing.
export async function POST(req: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await ctx.params;
  const master = await requireMaster(token);
  if (!master) return fail("Please open your link and enter your code again.", 401);

  const sid = startShipment(master.id, Number(id));
  const shipment = sid ? canUploadShipmentPhoto(master.id, sid) : null;
  if (!shipment) return fail("This order is not open for shipping.", 403);

  const form = await req.formData();
  const file = form.get("file");
  const kind = form.get("kind") === "package" ? "package" : "bill";
  if (!(file instanceof File)) return fail("Missing photo.");

  const saved = await storeUpload(shipment.orderId, file);
  if ("error" in saved) return fail(saved.error);
  const photoId = attachShipmentPhoto(shipment, kind, saved);
  return Response.json({ ok: true, id: photoId });
}
