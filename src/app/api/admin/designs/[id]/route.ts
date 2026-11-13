import { isAdmin } from "@/lib/admin-auth";
import { designPhoto } from "@/lib/designs";
import { get } from "@/lib/storage";

// A picture of a design in the library (id = the design picture). Admin only.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "Admin login needed." }, { status: 401 });
  const photo = designPhoto(Number((await ctx.params).id));
  if (!photo) return new Response("Not found", { status: 404 });
  const thumb = new URL(req.url).searchParams.get("thumb") === "1";
  const data = await get(thumb ? photo.thumbKey : photo.fileKey);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), { headers: { "content-type": "image/webp", "cache-control": "private, max-age=3600" } });
}
