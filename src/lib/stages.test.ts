import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import sharp from "sharp";

process.env.DATABASE_URL = ":memory:";

let t: typeof import("./templates");
let o: typeof import("./orders");
let m: typeof import("./masters");
let s: typeof import("./stages");
let st: typeof import("./storage");

beforeAll(async () => {
  const { db } = await import("@/db");
  migrate(db, { migrationsFolder: "./drizzle" });
  t = await import("./templates");
  o = await import("./orders");
  m = await import("./masters");
  s = await import("./stages");
  st = await import("./storage");
});

const base = (masterId: number, name = "C") => ({
  customerName: name, myDueDate: "2099-01-01", karigarDueDate: "2099-01-01", masterId, details: "",
});

/** Sherwani template with Cutting (no photo) > Embroidery (photo required) > Stitching (optional photo). */
function setup() {
  const main = t.createMainCategory("G" + Math.random(), "#000000");
  t.createSubCategory(main, "Sherwani", "#111111");
  const tplId = t.listCategoryTree().find((c) => c.id === main)!.subs[0].template.id;
  t.saveTemplate(tplId, [], t.rowsToStages([
    { key: "", label: "Cutting", photo: "none" },
    { key: "", label: "Embroidery", photo: "required" },
    { key: "", label: "Stitching", photo: "optional" },
  ]));
  const tpl = t.templateForItem(tplId)!;
  const master = m.createMaster({ name: "M", pin: "1" });
  const orderId = o.createOrder(base(master), [{ templateId: tplId, label: "Sherwani", snapshot: tpl.snapshot, values: {} }]);
  const itemId = o.listItems(orderId)[0].id;
  return { master, orderId, itemId };
}
const photo = (orderId: number, itemId: number, stageKey: string) =>
  s.addStagePhoto({ orderId, itemId, stageKey, uploadedBy: "master", fileKey: "k", thumbKey: "t", bytes: 1 });

describe("stages and the photo gate", () => {
  it("starts with the first stage open and the rest locked", () => {
    const { itemId } = setup();
    expect(s.itemStageViews(itemId).map((v) => v.status)).toEqual(["open", "locked", "locked"]);
  });

  it("blocks a photo-required stage until the photo is approved; rejection allows re-upload", () => {
    const { master, orderId, itemId } = setup();
    const who = { by: "master", masterId: master } as const;
    expect(s.completeStage(who, itemId, "cutting")).toEqual({ ok: true });
    expect(s.completeStage(who, itemId, "stitching")).toEqual({ ok: false, reason: "not-open" }); // still locked
    expect(s.completeStage(who, itemId, "embroidery")).toEqual({ ok: false, reason: "needs-photo" });

    const p1 = photo(orderId, itemId, "embroidery");
    expect(s.completeStage(who, itemId, "embroidery")).toEqual({ ok: false, reason: "needs-photo" }); // pending
    expect(s.reviewPhoto(p1, "rejected", "")).toEqual({ ok: false, reason: "comment-needed" });
    expect(s.reviewPhoto(p1, "rejected", "Wrong silver thread")).toEqual({ ok: true });
    expect(s.itemStageViews(itemId)[1].latestPhoto).toMatchObject({ status: "rejected", comment: "Wrong silver thread" });
    expect(s.completeStage(who, itemId, "embroidery")).toEqual({ ok: false, reason: "needs-photo" });

    const p2 = photo(orderId, itemId, "embroidery"); // re-upload
    expect(s.reviewPhoto(p2, "approved", "")).toEqual({ ok: true });
    expect(s.reviewPhoto(p2, "approved", "")).toEqual({ ok: false, reason: "not-pending" });
    expect(s.completeStage(who, itemId, "embroidery")).toEqual({ ok: true });
    expect(s.itemStageViews(itemId).map((v) => v.status)).toEqual(["done", "done", "open"]);
    // optional photo: can complete without one
    expect(s.completeStage(who, itemId, "stitching")).toEqual({ ok: true });
    expect(s.orderProgress(orderId)).toEqual({ done: 3, total: 3 });
  });

  it("lets a master upload and complete on any of his orders, not only the first", () => {
    const a = setup();
    const second = o.createOrder(base(a.master, "Second"), [
      { templateId: 0, label: "X", snapshot: o.listItems(a.orderId)[0].snapshot, values: {} },
    ]);
    const itemB = o.listItems(second)[0].id;
    const who = { by: "master", masterId: a.master } as const;
    expect(s.canMasterUpload(a.master, itemB, "cutting")).toEqual({ ok: false, reason: "no-photo-needed" });
    expect(s.completeStage(who, itemB, "cutting")).toEqual({ ok: true }); // no waiting for the first order
    expect(s.canMasterUpload(a.master, itemB, "embroidery")).toEqual({ ok: true, orderId: second });
    const p = photo(second, itemB, "embroidery");
    s.reviewPhoto(p, "approved", "");
    expect(s.completeStage(who, itemB, "embroidery")).toEqual({ ok: true });
  });

  it("only serves photos to the master who owns the order", () => {
    const a = setup();
    const other = m.createMaster({ name: "Other", pin: "2" });
    const pid = photo(a.orderId, a.itemId, "embroidery");
    expect(s.photoForMaster(a.master, pid)?.id).toBe(pid);
    expect(s.photoForMaster(other, pid)).toBeNull();
    expect(s.canMasterUpload(other, a.itemId, "cutting")).toEqual({ ok: false, reason: "not-found" });
    expect(s.completeStage({ by: "master", masterId: other }, a.itemId, "cutting")).toEqual({ ok: false, reason: "not-found" });
  });

  it("lists pending photos for review", () => {
    const a = setup();
    const before = s.pendingPhotoCount();
    photo(a.orderId, a.itemId, "embroidery");
    expect(s.pendingPhotoCount()).toBe(before + 1);
    expect(s.pendingPhotos()[0]).toMatchObject({ itemLabel: "Sherwani", stageLabel: "Embroidery" });
  });
});

describe("image processing", () => {
  it("shrinks a big phone photo to about 400 KB or less, long side 1600", async () => {
    const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, noise: { type: "gaussian", mean: 128, sigma: 40 } } } as never)
      .blur(8)
      .jpeg({ quality: 98 })
      .toBuffer();
    expect(big.length).toBeGreaterThan(1_000_000);
    const out = await st.processImage(big);
    expect(out).not.toBeNull();
    expect(out!.image.length).toBeLessThanOrEqual(400 * 1024);
    const meta = await sharp(out!.image).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBe(1600);
    expect(out!.thumb.length).toBeLessThan(out!.image.length);
  });

  it("rejects non-images", async () => {
    expect(await st.processImage(Buffer.from("hello"))).toBeNull();
  });
});

describe("mandatory fields before a stage", () => {
  const rowOf = (label: string, type: string, who: string, unit = "") => ({ key: "", label, type, required: "optional", unit, options: "", who });

  /** Kurta: Cutting needs Chest (master fills), Fabric (office fills) and a Design picture; Stitching needs nothing. */
  function setupFields() {
    const main = t.createMainCategory("F" + Math.random(), "#000000");
    t.createSubCategory(main, "Kurta", "#111111");
    const tplId = t.listCategoryTree().find((c) => c.id === main)!.subs[0].template.id;
    const fields = t.rowsToFields([rowOf("Chest", "number", "master", "inch"), rowOf("Fabric", "text", "admin"), rowOf("Design", "picture", "master")]);
    const [chest, fabric, design] = fields.map((f) => f.key);
    t.saveTemplate(
      tplId,
      fields,
      t.rowsToStages([
        { key: "", label: "Cutting", photo: "none", requires: [chest, fabric, design, "a-field-that-does-not-exist"] },
        { key: "", label: "Stitching", photo: "none" },
      ]),
    );
    const tpl = t.templateForItem(tplId)!;
    const master = m.createMaster({ name: "M", pin: "1" });
    const orderId = o.createOrder(base(master), [{ templateId: tplId, label: "Kurta", snapshot: tpl.snapshot, values: {} }]);
    const itemId = o.listItems(orderId)[0].id;
    return { tplId, master, orderId, itemId, chest, fabric, design };
  }

  it("keeps only real input fields as requirements, and nothing when none are chosen", () => {
    const { tplId, chest, fabric, design } = setupFields();
    const stages = t.templateForItem(tplId)!.snapshot.stages!;
    expect(stages[0].requiresFields).toEqual([chest, fabric, design]); // the ghost key was dropped on save
    expect(stages[1]).not.toHaveProperty("requiresFields");
    expect(t.stagesFromBuilder(JSON.stringify([{ label: "A", photo: "none", needs: [chest, 5, chest] }]))[0].requiresFields).toEqual([chest]);
  });

  it("blocks the stage until every mandatory field is filled, for the master and for Admin", () => {
    const { master, orderId, itemId, chest, fabric, design } = setupFields();
    const who = { by: "master", masterId: master } as const;
    expect(s.completeStage(who, itemId, "cutting")).toEqual({ ok: false, reason: "needs-fields" });
    expect(s.completeStage({ by: "admin" }, itemId, "cutting")).toEqual({ ok: false, reason: "needs-fields" });
    expect(s.itemStageViews(itemId)[0]).toMatchObject({ fieldsOk: false });
    expect(s.itemStageViews(itemId)[0].requiredFields.map((r) => [r.label, r.filled, r.masterCanEdit])).toEqual([
      ["Chest", false, true],
      ["Fabric", false, false],
      ["Design", false, true],
    ]);

    // the master fills what he is allowed to; the office-only field stays out of his reach
    expect(o.masterSaveFields(master, orderId, itemId, { [chest]: "42", [fabric]: "silk" })).toBe(true);
    expect(o.listItems(orderId)[0].values).toEqual({ [chest]: "42" });
    expect(s.completeStage(who, itemId, "cutting")).toEqual({ ok: false, reason: "needs-fields" });

    // Admin fills the office field, then a picture is attached to the picture field
    o.updateOrder(orderId, base(master), new Map([[itemId, { [chest]: "42", [fabric]: "silk" }]]));
    expect(s.completeStage(who, itemId, "cutting")).toEqual({ ok: false, reason: "needs-fields" }); // still no picture
    s.addReferencePhoto({ orderId, itemId, fieldKey: design, uploadedBy: "master", fileKey: "k", thumbKey: "t", bytes: 1 });
    expect(s.itemStageViews(itemId)[0]).toMatchObject({ fieldsOk: true });
    expect(s.completeStage(who, itemId, "cutting")).toEqual({ ok: true });
    expect(s.itemStageViews(itemId).map((v) => v.status)).toEqual(["done", "open"]);
  });
});

describe("photo download names", () => {
  it("names a photo after its order, step or field, and id, with only safe characters", () => {
    const { orderId, itemId } = setup();
    const order = o.getOrder(orderId)!;
    const p = photo(orderId, itemId, "embroidery");
    expect(s.photoDownloadName(p)).toBe(`order-${order.orderNumber}-embroidery-${p}.jpg`);
    const r = s.addReferencePhoto({ orderId, itemId, fieldKey: "Design / Front!", fileKey: "k", thumbKey: "t", bytes: 1 });
    expect(s.photoDownloadName(r)).toBe(`order-${order.orderNumber}-design-front-${r}.jpg`);
    expect(s.photoDownloadName(999999)).toBe("photo-999999.jpg");
  });
});
