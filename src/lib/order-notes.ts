import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { orders, photos } from "@/db/schema";
import { remove } from "./storage";
import { storeUpload } from "./photo-upload";

/** Pictures under the "Extra notes" box of a customer: reference pictures of the order itself (no item), field key "notes". */
export const NOTES_KEY = "notes";

const own = (orderId: number) =>
  and(eq(photos.orderId, orderId), isNull(photos.itemId), eq(photos.type, "reference"), eq(photos.fieldKey, NOTES_KEY));

export function notePhotos(orderId: number): { id: number }[] {
  return db.select({ id: photos.id }).from(photos).where(own(orderId)).orderBy(asc(photos.id)).all();
}

/** Stores the pictures chosen under the notes. A bad file is skipped. Returns how many were saved. */
export async function addNotePictures(orderId: number, files: File[]): Promise<number> {
  let n = 0;
  for (const file of files) {
    if (file.size === 0) continue;
    const saved = await storeUpload(orderId, file);
    if ("error" in saved) continue;
    db.insert(photos).values({ orderId, itemId: null, fieldKey: NOTES_KEY, type: "reference", uploadedBy: "admin", status: "approved", ...saved }).run();
    n++;
  }
  if (n > 0) db.update(orders).set({ changedForMasterAt: new Date() }).where(eq(orders.id, orderId)).run(); // the master sees "Updated"
  return n;
}

export async function removeNotePicture(orderId: number, photoId: number) {
  const row = db.select().from(photos).where(and(own(orderId), eq(photos.id, photoId))).get();
  if (!row) return;
  db.delete(photos).where(eq(photos.id, row.id)).run();
  await remove(row.fileKey);
  await remove(row.thumbKey);
}

/** Takes one saved reference picture off an item (the cross on a picture under a field). Only the office's own reference pictures. */
export async function removeItemPicture(itemId: number, photoId: number) {
  const row = db.select().from(photos).where(and(eq(photos.id, photoId), eq(photos.itemId, itemId), eq(photos.type, "reference"))).get();
  if (!row) return;
  db.delete(photos).where(eq(photos.id, row.id)).run();
  await remove(row.fileKey);
  await remove(row.thumbKey);
  db.update(orders).set({ changedForMasterAt: new Date() }).where(and(eq(orders.id, row.orderId), isNotNull(orders.masterSeenAt))).run(); // a master who opened it sees "Updated"
}
