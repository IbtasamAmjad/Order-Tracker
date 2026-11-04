import sharp from "sharp";
import { photoDownloadName } from "./stages";
import { get } from "./storage";

/**
 * A photo as a file download: full size, re-encoded as JPEG so it opens on every phone and computer
 * (we store WebP to save space). The caller has already checked that this person may see the photo.
 */
export async function photoDownloadResponse(photo: { id: number; fileKey: string }): Promise<Response> {
  const data = await get(photo.fileKey);
  if (!data) return new Response("Not found", { status: 404 });
  const jpeg = await sharp(data).rotate().jpeg({ quality: 90 }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "content-type": "image/jpeg",
      "content-disposition": `attachment; filename="${photoDownloadName(photo.id)}"`,
      "cache-control": "private, no-store",
    },
  });
}
