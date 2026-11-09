import { requireMaster } from "@/lib/master-session";
import { storeUpload } from "@/lib/photo-upload";
import { addStagePhoto, canMasterUpload } from "@/lib/stages";

const fail = (error: string, status = 400) => Response.json({ error }, { status });

const WHY: Record<string, string> = {
  "not-found": "This item was not found.",
  "not-open": "This step is not open yet.",
  "no-photo-needed": "This step does not need a photo.",
  "order-closed": "This order is closed.",
};

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const master = await requireMaster(token);
  if (!master) return fail("Please open your link and enter your code again.", 401);

  const form = await req.formData();
  const file = form.get("file");
  const itemId = Number(form.get("itemId"));
  const stageKey = String(form.get("stageKey") ?? "");
  if (!(file instanceof File) || !itemId || !stageKey) return fail("Missing photo.");

  const check = canMasterUpload(master.id, itemId, stageKey);
  if (!check.ok) return fail(WHY[check.reason] ?? "Not allowed.", 403);

  const saved = await storeUpload(check.orderId, file);
  if ("error" in saved) return fail(saved.error);
  const id = addStagePhoto({ orderId: check.orderId, itemId, stageKey, uploadedBy: "master", masterId: master.id, ...saved });
  return Response.json({ ok: true, id });
}
