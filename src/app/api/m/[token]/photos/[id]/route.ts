import { requireMaster } from "@/lib/master-session";
import { photoForMaster } from "@/lib/stages";
import { get } from "@/lib/storage";
import { photoDownloadResponse } from "@/lib/photo-download";

export async function GET(req: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await ctx.params;
  const master = await requireMaster(token);
  if (!master) return new Response("Not found", { status: 404 });
  const photo = photoForMaster(master.id, Number(id));
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
