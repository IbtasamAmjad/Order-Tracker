import sharp from "sharp";
import { photoDownloadName } from "./stages";
import { get } from "./storage";
import { makeZip, type ZipFile } from "./zip";

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

/**
 * Several photos as one ZIP download (full size JPEGs, named like the single downloads). The caller has already
 * checked that this person may see every one of them.
 */
export async function photosZipResponse(list: { id: number; fileKey: string }[], zipName: string): Promise<Response> {
  const files: ZipFile[] = [];
  for (const photo of list) {
    const data = await get(photo.fileKey);
    if (!data) continue;
    files.push({ name: photoDownloadName(photo.id), data: await sharp(data).rotate().jpeg({ quality: 90 }).toBuffer() });
  }
  if (files.length === 0) return new Response("Not found", { status: 404 });
  const safe = zipName.replace(/[^A-Za-z0-9._-]+/g, "-");
  return new Response(new Uint8Array(makeZip(files)), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${safe}"`,
      "cache-control": "private, no-store",
    },
  });
}
