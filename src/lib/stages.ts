import { and, asc, desc, eq } from "drizzle-orm";
import { isDisplayOnly } from "@/lib/items";
import { isAssigned, mine } from "./assign";
import { addEvent } from "./history";
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
      .values({ itemId, stageKey: s.key, position: i + 1, status: i === 0 ? "open" : "locked", startedAt: i === 0 ? new Date() : null })
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
  /** every image sent for this step, oldest first (an optional step can have several) */
  allPhotos: { id: number; status: "pending" | "approved" | "rejected" }[];
  /** photo gate satisfied (not required, or latest photo approved) */
  photoOk: boolean;
  /** form fields the admin made mandatory before this stage can be finished, and whether each one is filled */
  requiredFields: RequiredField[];
  /** every mandatory field is filled in */
  fieldsOk: boolean;
  /** how many days the step should take once started (null = no target) */
  days: number | null;
  /** when the step started and when it should be finished (only for the open step with a target) */
  startedAt: Date | null;
  dueAt: Date | null;
  /** whole days past the target (0 = not late) */
  lateDays: number;
};

const DAY_MS = 86_400_000;

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

export function itemStageViews(itemId: number, now: Date = new Date()): StageView[] {
  const item = db.select().from(orderItems).where(eq(orderItems.id, itemId)).get();
  if (!item) return [];
  const defs = item.snapshot.stages ?? [];
  const rows = db.select().from(itemStages).where(eq(itemStages.itemId, itemId)).orderBy(asc(itemStages.position)).all();
  const round = item.remadeAt?.getTime() ?? 0; // step photos from before a remake belong to the old round
  const stagePhotos = db
    .select()
    .from(photos)
    .where(and(eq(photos.itemId, itemId), eq(photos.type, "stage")))
    .orderBy(desc(photos.id))
    .all()
    .filter((p) => p.uploadedAt.getTime() >= round);
  const pictureKeys = pictureKeysOf(db, itemId);
  return rows.map((r) => {
    const def = defs.find((d) => d.key === r.stageKey);
    const latest = stagePhotos.find((p) => p.stageKey === r.stageKey) ?? null;
    const rule = def?.photo ?? "none";
    const requiredFields = stageRequirements(item, def, pictureKeys);
    const days = def?.days && def.days > 0 ? def.days : null;
    const dueAt = days && r.status === "open" && r.startedAt ? new Date(r.startedAt.getTime() + days * DAY_MS) : null;
    const lateDays = dueAt && now.getTime() > dueAt.getTime() ? Math.max(1, Math.floor((now.getTime() - dueAt.getTime()) / DAY_MS)) : 0; // late today counts as 1
    return {
      key: r.stageKey,
      label: def?.label ?? r.stageKey,
      photo: rule,
      status: r.status,
      completedAt: r.completedAt,
      latestPhoto: latest ? { id: latest.id, status: latest.status, comment: latest.comment } : null,
      allPhotos: stagePhotos
        .filter((p) => p.stageKey === r.stageKey)
        .map((p) => ({ id: p.id, status: p.status }))
        .reverse(),
      photoOk: rule === "required" ? latest?.status === "approved" : rule === "upload" ? stagePhotos.some((p) => p.stageKey === r.stageKey) : true,
      requiredFields,
      fieldsOk: requiredFields.every((x) => x.filled),
      days,
      startedAt: r.status === "open" ? r.startedAt : null,
      dueAt,
      lateDays,
    };
  });
}

/** The started steps of an active customer that have taken longer than their expected days. */
export function lateSteps(orderId: number, now: Date = new Date()): { itemLabel: string; step: string; lateDays: number }[] {
  const items = db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all();
  const out: { itemLabel: string; step: string; lateDays: number }[] = [];
  for (const it of items) {
    for (const s of itemStageViews(it.id, now)) if (s.lateDays > 0) out.push({ itemLabel: it.label, step: s.label, lateDays: s.lateDays });
  }
  return out;
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

/** May this master work on the order? It must be one of his own and still active. There is no waiting for earlier orders. */
export function isMasterTurn(masterId: number, orderId: number): boolean {
  const o = db.select().from(orders).where(and(eq(orders.id, orderId), mine(masterId))).get();
  return !!o && o.status === "active";
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
  if (!s || !isAssigned(masterId, s.order.id)) return { ok: false, reason: "not-found" };
  if (s.order.status !== "active") return { ok: false, reason: "order-closed" };
  if (s.row.status !== "open") return { ok: false, reason: "not-open" };
  if ((s.def?.photo ?? "none") === "none") return { ok: false, reason: "no-photo-needed" };
  return { ok: true, orderId: s.order.id };
}

export type CompleteStageResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "not-open" | "needs-fields" | "needs-photo" | "blocked" | "order-closed" | "not-confirmed" };

/**
 * Complete a stage and unlock the next one.
 * - stage must be open
 * - every field the admin made mandatory for this stage must be filled in
 * - photo-required stage: latest photo must be approved by Admin
 * - master: any of his own active orders (no waiting for earlier orders)
 * - Admin with force: finishes a stuck step without the photo or fields check (the stage must still be open)
 */
export function completeStage(
  who: { by: "master"; masterId: number } | { by: "admin"; force?: boolean },
  itemId: number,
  stageKey: string,
): CompleteStageResult {
  return db.transaction((tx) => {
    const s = loadStage(itemId, stageKey);
    if (!s) return { ok: false, reason: "not-found" } as const;
    if (who.by === "master" && !isAssigned(who.masterId, s.order.id)) return { ok: false, reason: "not-found" } as const;
    if (s.order.status !== "active") return { ok: false, reason: "order-closed" } as const;
    if (s.row.status !== "open") return { ok: false, reason: "not-open" } as const;
    if (who.by === "master" && !isMasterTurn(who.masterId, s.order.id)) return { ok: false, reason: "blocked" } as const;
    // the first step is the master saying he has seen the order: nothing else can be finished by him before that
    if (who.by === "master" && !s.order.confirmedAt) return { ok: false, reason: "not-confirmed" } as const;

    const force = who.by === "admin" && who.force === true;
    const missing = stageRequirements(s.item, s.def, pictureKeysOf(tx, itemId)).filter((x) => !x.filled);
    if (missing.length > 0 && !force) return { ok: false, reason: "needs-fields" } as const;

    if ((s.def?.photo ?? "none") === "required" && !force) {
      const latest = tx
        .select()
        .from(photos)
        .where(and(eq(photos.itemId, itemId), eq(photos.stageKey, stageKey), eq(photos.type, "stage")))
        .orderBy(desc(photos.id))
        .all()
        .find((p) => p.uploadedAt.getTime() >= (s.item.remadeAt?.getTime() ?? 0));
      if (latest?.status !== "approved") return { ok: false, reason: "needs-photo" } as const;
    }

    // a step that must have an image (no approval needed): at least one image has to be added
    if ((s.def?.photo ?? "none") === "upload" && !force) {
      const any = tx
        .select({ at: photos.uploadedAt })
        .from(photos)
        .where(and(eq(photos.itemId, itemId), eq(photos.stageKey, stageKey), eq(photos.type, "stage")))
        .all()
        .some((p) => p.at.getTime() >= (s.item.remadeAt?.getTime() ?? 0));
      if (!any) return { ok: false, reason: "needs-photo" } as const;
    }

    const now = new Date();
    tx.update(itemStages)
      .set({ status: "done", completedAt: now, completedBy: who.by })
      .where(eq(itemStages.id, s.row.id))
      .run();
    tx.update(itemStages)
      .set({ status: "open", startedAt: now }) // the next step starts now: its expected days count from here
      .where(and(eq(itemStages.itemId, itemId), eq(itemStages.position, s.row.position + 1)))
      .run();
    tx.update(orders).set({ updatedAt: now }).where(eq(orders.id, s.order.id)).run();
    addEvent({ orderId: s.order.id, itemId, stageKey, kind: "done", by: who.by, masterId: who.by === "master" ? who.masterId : null }, tx);
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

export function addStagePhoto(p: NewPhoto & { stageKey: string; uploadedBy: "admin" | "master"; masterId?: number }) {
  const { masterId, ...row } = p;
  const id = db.insert(photos).values({ ...row, type: "stage", status: "pending" }).returning({ id: photos.id }).get().id;
  addEvent({ orderId: p.orderId, itemId: p.itemId, stageKey: p.stageKey, kind: "image", by: p.uploadedBy, masterId: masterId ?? null });
  return id;
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
    .select({ id: photos.id, fieldKey: photos.fieldKey, fromDesignId: photos.fromDesignId })
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

/** Photos waiting for a decision, on orders that are still active (a cancelled or finished order's photo needs no decision). */
export function pendingPhotoCount(): number {
  return db
    .select({ id: photos.id })
    .from(photos)
    .innerJoin(orders, eq(photos.orderId, orders.id))
    .where(and(eq(photos.type, "stage"), eq(photos.status, "pending"), eq(orders.status, "active")))
    .all().length;
}

/** Review queue: newest first, with order / item / stage context. */
export function pendingPhotos() {
  const rows = db
    .select({ photo: photos, item: orderItems, order: orders, masterName: masters.name })
    .from(photos)
    .innerJoin(orderItems, eq(photos.itemId, orderItems.id))
    .innerJoin(orders, eq(photos.orderId, orders.id))
    .innerJoin(masters, eq(orders.masterId, masters.id))
    .where(and(eq(photos.type, "stage"), eq(photos.status, "pending"), eq(orders.status, "active")))
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
  if (!o || !isAssigned(masterId, o.id) || o.status === "archived") return null;
  return p;
}

// --------------------------------------------------------------- what is waiting for the office

export type OfficeTodo = { orderId: number; orderNumber: number; customerName: string; itemLabel: string; stageLabel: string; fields: string[] };

/**
 * Open steps on active orders that cannot move because a mandatory field is one only the office can fill in.
 * Photos waiting for a decision are counted separately (pendingPhotoCount).
 */
export function officeTodo(): OfficeTodo[] {
  const rows = db
    .select({ item: orderItems, order: orders })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orders.status, "active"))
    .orderBy(asc(orders.orderNumber), asc(orderItems.position))
    .all();
  const out: OfficeTodo[] = [];
  for (const { item, order } of rows) {
    for (const stage of itemStageViews(item.id)) {
      if (stage.status !== "open") continue;
      const fields = stage.requiredFields.filter((f) => !f.filled && !f.masterCanEdit).map((f) => f.label);
      if (fields.length > 0) {
        out.push({ orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, itemLabel: item.label, stageLabel: stage.label, fields });
      }
    }
  }
  return out;
}
