import { isAdmin } from "@/lib/admin-auth";
import { getPhoto } from "@/lib/stages";
import { get } from "@/lib/storage";
import { photoDownloadResponse } from "@/lib/photo-download";

// Admin side (needs the admin sign-in).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "Admin login needed." }, { status: 401 });
  const photo = getPhoto(Number((await ctx.params).id));
  if (!photo) return new Response("Not found", { status: 404 });
  const query = new URL(req.url).searchParams;
  if (query.get("download") === "1") return photoDownloadResponse(photo);
  const thumb = query.get("thumb") === "1";
  const data = await get(thumb ? photo.thumbKey : photo.fileKey);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "content-type": "image/webp", "cache-control": "private, max-age=3600" },
  });
}
