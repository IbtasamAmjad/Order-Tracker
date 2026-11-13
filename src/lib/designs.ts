import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { designPhotos, designs, orderItems, orders, photos } from "@/db/schema";
import { get, randomKey, remove, save } from "./storage";
import { processImage } from "./storage";

export type DesignRow = {
  id: number;
  name: string; // the design number
  notes: string;
  active: boolean;
  photoIds: number[];
};

function withPhotos(rows: (typeof designs.$inferSelect)[]): DesignRow[] {
  const all = db.select({ id: designPhotos.id, designId: designPhotos.designId }).from(designPhotos).orderBy(asc(designPhotos.id)).all();
  return rows.map((d) => ({ ...d, photoIds: all.filter((p) => p.designId === d.id).map((p) => p.id) }));
}

/** Every design, newest first. */
export function listDesigns(opts: { activeOnly?: boolean } = {}): DesignRow[] {
  const rows = db
    .select()
    .from(designs)
    .where(opts.activeOnly ? eq(designs.active, true) : undefined)
    .all()
    .sort((a, b) => b.id - a.id);
  return withPhotos(rows);
}

/** The design with this design number (capitals and spaces around it do not matter), or null. */
export function designByName(name: string): DesignRow | null {
  const want = name.trim().toLowerCase();
  if (!want) return null;
  const d = db.select().from(designs).all().find((x) => x.name.trim().toLowerCase() === want);
  return d ? withPhotos([d])[0] : null;
}

function checkName(name: string, ownId?: number): string {
  const n = name.trim();
  if (!n) throw new Error("Please give the design a design number.");
  const clash = designByName(n);
  if (clash && clash.id !== ownId) throw new Error(`Design number ${clash.name} is already in your list.`);
  return n;
}

export function getDesign(id: number): DesignRow | null {
  const d = db.select().from(designs).where(eq(designs.id, id)).get();
  return d ? withPhotos([d])[0] : null;
}

export function designPhoto(id: number) {
  return db.select().from(designPhotos).where(eq(designPhotos.id, id)).get();
}

/** Stores the chosen pictures under the design. A bad file is skipped. Returns how many were saved. */
export async function addDesignPictures(designId: number, files: File[]): Promise<number> {
  let n = 0;
  for (const file of files) {
    if (file.size === 0) continue;
    const out = await processImage(Buffer.from(await file.arrayBuffer()));
    if (!out) continue;
    const fileKey = randomKey(`designs/${designId}`, "webp");
    const thumbKey = randomKey(`designs/${designId}`, "webp");
    await save(fileKey, out.image);
    await save(thumbKey, out.thumb);
    db.insert(designPhotos).values({ designId, fileKey, thumbKey, bytes: out.image.length }).run();
    n++;
  }
  return n;
}

export function createDesign(input: { name: string; notes?: string }): number {
  const name = checkName(input.name);
  return db
    .insert(designs)
    .values({ name, notes: (input.notes ?? "").trim() })
    .returning({ id: designs.id })
    .get().id;
}

export function updateDesign(id: number, input: { name: string; notes?: string; active?: boolean }) {
  const name = checkName(input.name, id);
  db.update(designs)
    .set({ name, notes: (input.notes ?? "").trim(), ...(input.active === undefined ? {} : { active: input.active }) })
    .where(eq(designs.id, id))
    .run();
}

export async function removeDesignPicture(designId: number, photoId: number) {
  const row = db.select().from(designPhotos).where(and(eq(designPhotos.id, photoId), eq(designPhotos.designId, designId))).get();
  if (!row) return;
  db.delete(designPhotos).where(eq(designPhotos.id, row.id)).run();
  await remove(row.fileKey);
  await remove(row.thumbKey);
}

/**
 * Chooses a design for an item: its pictures are COPIED onto the item as reference pictures (the same as pictures
 * the office adds by hand), so later changes to the design never touch this customer. Choosing the design the item
 * already has does nothing; choosing another one takes the earlier design's pictures off first.
 * Returns how many pictures were attached.
 */
export async function attachDesign(orderId: number, itemId: number, designId: number | null): Promise<number> {
  const item = db.select().from(orderItems).where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId))).get();
  if (!item) return 0;
  if ((item.designId ?? null) === designId) return 0;

  // take the earlier design's pictures off (they were saved with no field key and are marked by the design)
  if (item.designId) {
    const old = db.select().from(photos).where(and(eq(photos.itemId, itemId), eq(photos.type, "reference"), eq(photos.fromDesignId, item.designId))).all();
    for (const p of old) {
      db.delete(photos).where(eq(photos.id, p.id)).run();
      await remove(p.fileKey);
      await remove(p.thumbKey);
    }
  }
  let n = 0;
  const d = designId ? getDesign(designId) : null;
  if (d) {
    for (const pid of d.photoIds) {
      const src = designPhoto(pid);
      if (!src) continue;
      const [image, thumb] = [await get(src.fileKey), await get(src.thumbKey)];
      if (!image || !thumb) continue;
      const fileKey = randomKey(`orders/${orderId}`, "webp");
      const thumbKey = randomKey(`orders/${orderId}`, "webp");
      await save(fileKey, image);
      await save(thumbKey, thumb);
      db.insert(photos).values({ orderId, itemId, fieldKey: null, fromDesignId: d.id, type: "reference", uploadedBy: "admin", status: "approved", fileKey, thumbKey, bytes: src.bytes }).run();
      n++;
    }
  }
  db.update(orderItems).set({ designId: d ? d.id : null }).where(eq(orderItems.id, itemId)).run();
  // a master who has already opened the order sees "Updated"; a new order is simply New
  db.update(orders).set({ changedForMasterAt: new Date() }).where(and(eq(orders.id, orderId), isNotNull(orders.masterSeenAt))).run();
  return n;
}
