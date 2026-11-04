import { and, asc, desc, eq } from "drizzle-orm";
import { isDisplayOnly } from "@/lib/items";
import { db } from "@/db";
import {
  itemStages,
  masters,
  orderItems,
  orders,
  photos,
  type PhotoRule,
  type StageDef,
  type StageStatus,
} from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbLike = typeof db | Tx;

/** Stage rows for a new item: the first stage is open, the rest locked. */
export function createStageRows(d: DbLike, itemId: number, stages: StageDef[]) {
  stages.forEach((s, i) =>
    d
      .insert(itemStages)
      .values({ itemId, stageKey: s.key, position: i + 1, status: i === 0 ? "open" : "locked" })
      .run(),
  );
}

// --------------------------------------------------------------- views

export type StagePhoto = { id: number; status: "pending" | "approved" | "rejected"; comment: string | null };

export type StageView = {
  key: string;
  label: string;
  photo: PhotoRule;
  status: StageStatus;
  completedAt: Date | null;
  latestPhoto: StagePhoto | null;
  /** photo gate satisfied (not required, or latest photo approved) */
  photoOk: boolean;
  /** form fields the admin made mandatory before this stage can be finished, and whether each one is filled */
  requiredFields: RequiredField[];
  /** every mandatory field is filled in */
  fieldsOk: boolean;
};

export type RequiredField = { key: string; label: string; masterCanEdit: boolean; filled: boolean };

/**
 * The mandatory fields of a stage and whether each is filled. A picture field counts as filled
 * once at least one picture is attached; every other field once it has text.
 * A key that is no longer in the item's form is ignored, so a removed field can never block a stage.
 */
export function stageRequirements(
  item: { id: number; values: Record<string, string>; snapshot: { fields: { key: string; label: string; type: string; masterCanEdit?: boolean }[] } },
  def: { requiresFields?: string[] } | undefined,
  pictureKeys: Set<string>,
): RequiredField[] {
  const out: RequiredField[] = [];
  for (const key of def?.requiresFields ?? []) {
    const f = item.snapshot.fields.find((x) => x.key === key);
    if (!f || isDisplayOnly(f)) continue;
    const filled = f.type === "picture" ? pictureKeys.has(key) : (item.values[key] ?? "").trim() !== "";
    out.push({ key, label: f.label, masterCanEdit: !!f.masterCanEdit, filled });
  }
  return out;
}

function pictureKeysOf(d: DbLike, itemId: number): Set<string> {
  return new Set(
    d
      .select({ fieldKey: photos.fieldKey })
      .from(photos)
      .where(and(eq(photos.itemId, itemId), eq(photos.type, "reference")))
      .all()
      .map((p) => p.fieldKey ?? ""),
  );
}

export function itemStageViews(itemId: number): StageView[] {
  const item = db.select().from(orderItems).where(eq(orderItems.id, itemId)).get();
  if (!item) return [];
  const defs = item.snapshot.stages ?? [];
  const rows = db.select().from(itemStages).where(eq(itemStages.itemId, itemId)).orderBy(asc(itemStages.position)).all();
  const stagePhotos = db
    .select()
    .from(photos)
    .where(and(eq(photos.itemId, itemId), eq(photos.type, "stage")))
    .orderBy(desc(photos.id))
    .all();
  const pictureKeys = pictureKeysOf(db, itemId);
  return rows.map((r) => {
    const def = defs.find((d) => d.key === r.stageKey);
    const latest = stagePhotos.find((p) => p.stageKey === r.stageKey) ?? null;
    const rule = def?.photo ?? "none";
    const requiredFields = stageRequirements(item, def, pictureKeys);
    return {
      key: r.stageKey,
      label: def?.label ?? r.stageKey,
      photo: rule,
      status: r.status,
      completedAt: r.completedAt,
      latestPhoto: latest ? { id: latest.id, status: latest.status, comment: latest.comment } : null,
      photoOk: rule !== "required" || latest?.status === "approved",
      requiredFields,
      fieldsOk: requiredFields.every((x) => x.filled),
    };
  });
}

/** "3/10 stages" for an order, across all its items. */
export function orderProgress(orderId: number): { done: number; total: number } {
  const rows = db
    .select({ status: itemStages.status })
    .from(itemStages)
    .innerJoin(orderItems, eq(itemStages.itemId, orderItems.id))
    .where(eq(orderItems.orderId, orderId))
    .all();
  return { done: rows.filter((r) => r.status === "done").length, total: rows.length };
}

// ------------------------------------------------------- permissions

/** Is it this master's turn on the order (first in his list, or Admin allowed it)? */
export function isMasterTurn(masterId: number, orderId: number): boolean {
  const o = db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.masterId, masterId))).get();
  if (!o || o.status !== "active") return false;
  if (o.allowOutOfSequence) return true;
  const first = db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.masterId, masterId), eq(orders.status, "active")))
    .orderBy(asc(orders.priorityPosition))
    .limit(1)
    .get();
  return first?.id === o.id;
}

function loadStage(itemId: number, stageKey: string) {
  const item = db.select().from(orderItems).where(eq(orderItems.id, itemId)).get();
  if (!item) return null;
  const row = db
    .select()
    .from(itemStages)
    .where(and(eq(itemStages.itemId, itemId), eq(itemStages.stageKey, stageKey)))
    .get();
  if (!row) return null;
  const order = db.select().from(orders).where(eq(orders.id, item.orderId)).get()!;
  const def = item.snapshot.stages?.find((s) => s.key === stageKey);
  return { item, row, order, def };
}

export type UploadCheck = { ok: true; orderId: number } | { ok: false; reason: "not-found" | "not-open" | "no-photo-needed" | "order-closed" };

/** A master may upload a stage photo on any of his active orders, as long as the stage is open. */
export function canMasterUpload(masterId: number, itemId: number, stageKey: string): UploadCheck {
  const s = loadStage(itemId, stageKey);
  if (!s || s.order.masterId !== masterId) return { ok: false, reason: "not-found" };
  if (s.order.status !== "active") return { ok: false, reason: "order-closed" };
  if (s.row.status !== "open") return { ok: false, reason: "not-open" };
  if ((s.def?.photo ?? "none") === "none") return { ok: false, reason: "no-photo-needed" };
  return { ok: true, orderId: s.order.id };
}

export type CompleteStageResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "not-open" | "needs-fields" | "needs-photo" | "blocked" | "order-closed" };

/**
 * Complete a stage and unlock the next one.
 * - stage must be open
 * - every field the admin made mandatory for this stage must be filled in
 * - photo-required stage: latest photo must be approved by Admin
 * - master: only while it is his turn on the order (Admin can override per order)
 */
export function completeStage(
  who: { by: "master"; masterId: number } | { by: "admin" },
  itemId: number,
  stageKey: string,
): CompleteStageResult {
  return db.transaction((tx) => {
    const s = loadStage(itemId, stageKey);
    if (!s) return { ok: false, reason: "not-found" } as const;
    if (who.by === "master" && s.order.masterId !== who.masterId) return { ok: false, reason: "not-found" } as const;
    if (s.order.status !== "active") return { ok: false, reason: "order-closed" } as const;
    if (s.row.status !== "open") return { ok: false, reason: "not-open" } as const;
    if (who.by === "master" && !isMasterTurn(who.masterId, s.order.id)) return { ok: false, reason: "blocked" } as const;

    const missing = stageRequirements(s.item, s.def, pictureKeysOf(tx, itemId)).filter((x) => !x.filled);
    if (missing.length > 0) return { ok: false, reason: "needs-fields" } as const;

    if ((s.def?.photo ?? "none") === "required") {
      const latest = tx
        .select()
        .from(photos)
        .where(and(eq(photos.itemId, itemId), eq(photos.stageKey, stageKey), eq(photos.type, "stage")))
        .orderBy(desc(photos.id))
        .limit(1)
        .get();
      if (latest?.status !== "approved") return { ok: false, reason: "needs-photo" } as const;
    }

    const now = new Date();
    tx.update(itemStages)
      .set({ status: "done", completedAt: now, completedBy: who.by })
      .where(eq(itemStages.id, s.row.id))
      .run();
    tx.update(itemStages)
      .set({ status: "open" })
      .where(and(eq(itemStages.itemId, itemId), eq(itemStages.position, s.row.position + 1)))
      .run();
    tx.update(orders).set({ updatedAt: now }).where(eq(orders.id, s.order.id)).run();
    return { ok: true } as const;
  });
}

// --------------------------------------------------------------- photos

type NewPhoto = {
  orderId: number;
  itemId: number;
  fileKey: string;
  thumbKey: string;
  bytes: number;
};

export function addStagePhoto(p: NewPhoto & { stageKey: string; uploadedBy: "admin" | "master" }) {
  return db.insert(photos).values({ ...p, type: "stage", status: "pending" }).returning({ id: photos.id }).get().id;
}

/** Pictures for a "picture" field. Admin or (where allowed) the master adds them; no approval needed. */
export function addReferencePhoto(p: NewPhoto & { fieldKey: string; uploadedBy?: "admin" | "master" }) {
  const { uploadedBy = "admin", ...rest } = p;
  return db
    .insert(photos)
    .values({ ...rest, type: "reference", uploadedBy, status: "approved" })
    .returning({ id: photos.id })
    .get().id;
}

export function referencePhotos(itemId: number) {
  return db
    .select({ id: photos.id, fieldKey: photos.fieldKey })
    .from(photos)
    .where(and(eq(photos.itemId, itemId), eq(photos.type, "reference")))
    .orderBy(asc(photos.id))
    .all();
}

export type ReviewResult = { ok: true } | { ok: false; reason: "not-found" | "not-pending" | "comment-needed" };

/** Admin approves or rejects. Rejecting needs a comment. The master is told via the "Updated" badge. */
export function reviewPhoto(id: number, decision: "approved" | "rejected", comment: string): ReviewResult {
  const p = db.select().from(photos).where(eq(photos.id, id)).get();
  if (!p || p.type !== "stage") return { ok: false, reason: "not-found" };
  if (p.status !== "pending") return { ok: false, reason: "not-pending" };
  if (decision === "rejected" && !comment.trim()) return { ok: false, reason: "comment-needed" };
  const now = new Date();
  db.update(photos)
    .set({ status: decision, comment: comment.trim() || null, reviewedAt: now })
    .where(eq(photos.id, id))
    .run();
  db.update(orders).set({ changedForMasterAt: now }).where(eq(orders.id, p.orderId)).run();
  return { ok: true };
}

export function pendingPhotoCount(): number {
  return db.select({ id: photos.id }).from(photos).where(and(eq(photos.type, "stage"), eq(photos.status, "pending"))).all().length;
}

/** Review queue: newest first, with order / item / stage context. */
export function pendingPhotos() {
  const rows = db
    .select({ photo: photos, item: orderItems, order: orders, masterName: masters.name })
    .from(photos)
    .innerJoin(orderItems, eq(photos.itemId, orderItems.id))
    .innerJoin(orders, eq(photos.orderId, orders.id))
    .innerJoin(masters, eq(orders.masterId, masters.id))
    .where(and(eq(photos.type, "stage"), eq(photos.status, "pending")))
    .orderBy(desc(photos.id))
    .all();
  return rows.map((r) => ({
    id: r.photo.id,
    uploadedAt: r.photo.uploadedAt,
    orderNumber: r.order.orderNumber,
    customerName: r.order.customerName,
    masterName: r.masterName,
    itemLabel: r.item.label,
    stageLabel: r.item.snapshot.stages?.find((s) => s.key === r.photo.stageKey)?.label ?? r.photo.stageKey ?? "",
  }));
}

/** A readable file name for a downloaded photo, e.g. "order-11-upload_picture-23.jpg". */
export function photoDownloadName(photoId: number): string {
  const p = db.select().from(photos).where(eq(photos.id, photoId)).get();
  if (!p) return `photo-${photoId}.jpg`;
  const o = db.select({ n: orders.orderNumber }).from(orders).where(eq(orders.id, p.orderId)).get();
  const what = p.type === "stage" ? (p.stageKey ?? "step") : p.type === "reference" ? (p.fieldKey ?? "picture") : p.type;
  const clean = what.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "photo";
  return `order-${o?.n ?? p.orderId}-${clean}-${photoId}.jpg`;
}

export function getPhoto(id: number) {
  return db.select().from(photos).where(eq(photos.id, id)).get();
}

/** A master may only open photos that belong to his own (visible) orders. */
export function photoForMaster(masterId: number, photoId: number) {
  const p = getPhoto(photoId);
  if (!p) return null;
  const o = db.select().from(orders).where(eq(orders.id, p.orderId)).get();
  if (!o || o.masterId !== masterId || o.status === "archived") return null;
  return p;
}
