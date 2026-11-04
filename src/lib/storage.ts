import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// All file access goes through this module (save / get / remove),
// so server disk can be swapped for R2 or similar later.
const ROOT = process.env.UPLOAD_DIR ?? "./data/uploads";

const safe = (key: string) => {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(path.resolve(ROOT) + path.sep)) throw new Error("bad key");
  return full;
};

export function randomKey(prefix: string, ext: string): string {
  return `${prefix}/${randomBytes(16).toString("hex")}.${ext}`;
}

export async function save(key: string, data: Buffer): Promise<void> {
  const full = safe(key);
  await fs.promises.mkdir(path.dirname(full), { recursive: true });
  await fs.promises.writeFile(full, data);
}

export async function get(key: string): Promise<Buffer | null> {
  try {
    return await fs.promises.readFile(safe(key));
  } catch {
    return null;
  }
}

export async function remove(key: string): Promise<void> {
  await fs.promises.rm(safe(key), { force: true });
}

// ------------------------------------------------------------ images

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // what we accept before re-encoding
const TARGET_BYTES = 400 * 1024;
const LONG_SIDE = 1600;

/**
 * Re-encode any JPEG/PNG/WebP to a small WebP (long side 1600 px, about 400 KB or less)
 * plus a thumbnail. The phone already compresses, this guarantees it and strips EXIF.
 */
export async function processImage(input: Buffer): Promise<{ image: Buffer; thumb: Buffer } | null> {
  if (input.length > MAX_UPLOAD_BYTES) return null;
  try {
    const meta = await sharp(input).metadata();
    if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) return null;
    const base = sharp(input).rotate().resize({ width: LONG_SIDE, height: LONG_SIDE, fit: "inside", withoutEnlargement: true });
    let image = Buffer.alloc(0);
    for (const q of [80, 70, 60, 50]) {
      image = await base.clone().webp({ quality: q }).toBuffer();
      if (image.length <= TARGET_BYTES) break;
    }
    const thumb = await sharp(image).resize({ width: 320, height: 320, fit: "inside" }).webp({ quality: 60 }).toBuffer();
    return { image, thumb };
  } catch {
    return null;
  }
}
