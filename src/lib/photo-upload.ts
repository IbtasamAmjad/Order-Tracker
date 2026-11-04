import { processImage, randomKey, save } from "./storage";

export type SavedFile = { fileKey: string; thumbKey: string; bytes: number };

/** Re-encode an uploaded image and store it (plus thumbnail) under the order's folder. */
export async function storeUpload(orderId: number, file: File): Promise<SavedFile | { error: string }> {
  const out = await processImage(Buffer.from(await file.arrayBuffer()));
  if (!out) return { error: "Please choose a normal photo (JPEG, PNG or WebP, under 12 MB)." };
  const fileKey = randomKey(`orders/${orderId}`, "webp");
  const thumbKey = randomKey(`orders/${orderId}`, "webp");
  await save(fileKey, out.image);
  await save(thumbKey, out.thumb);
  return { fileKey, thumbKey, bytes: out.image.length };
}
