import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

process.env.DATABASE_URL = ":memory:";

let t: typeof import("./templates");
let o: typeof import("./orders");
let m: typeof import("./masters");
let s: typeof import("./stages");
let sync: typeof import("./item-sync");

beforeAll(async () => {
  const { db } = await import("@/db");
  migrate(db, { migrationsFolder: "./drizzle" });
  t = await import("./templates");
  o = await import("./orders");
  m = await import("./masters");
  s = await import("./stages");
  sync = await import("./item-sync");
});

const base = (masterId: number, name = "C") => ({
  customerName: name, myDueDate: "2099-01-01", karigarDueDate: "2099-01-01", masterId, details: "",
});
const rowOf = (label: string, type: string, who: string) => ({ key: "", label, type, required: "optional", unit: "", options: "", who });
const newTemplate = (name: string) => {
  const main = t.createMainCategory("G" + Math.random(), "#000000");
  t.createSubCategory(main, name, "#111111");
  return t.listCategoryTree().find((c) => c.id === main)!.subs[0].template.id;
};
const stagePhoto = (orderId: number, itemId: number, stageKey: string) =>
  s.addStagePhoto({ orderId, itemId, stageKey, uploadedBy: "master", fileKey: "k", thumbKey: "t", bytes: 1 });

describe("the review queue only holds live orders", () => {
  it("drops a photo from the queue and the badge once its order is cancelled", () => {
    const tplId = newTemplate("Sherwani");
    t.saveTemplate(tplId, [], t.rowsToStages([{ key: "", label: "Embroidery", photo: "required" }]));
    const snapshot = t.templateForItem(tplId)!.snapshot;
    const master = m.createMaster({ name: "M", pin: "1" });
    const orderId = o.createOrder(base(master), [{ templateId: tplId, label: "Sherwani", snapshot, values: {} }]);
    const itemId = o.listItems(orderId)[0].id;

    const before = s.pendingPhotoCount();
    stagePhoto(orderId, itemId, "embroidery");
    expect(s.pendingPhotoCount()).toBe(before + 1);
    expect(s.pendingPhotos().some((p) => p.orderNumber === o.getOrder(orderId)!.orderNumber)).toBe(true);

    expect(o.setStatus(orderId, "cancelled")).toBe(true);
    expect(s.pendingPhotoCount()).toBe(before);
    expect(s.pendingPhotos().some((p) => p.orderNumber === o.getOrder(orderId)!.orderNumber)).toBe(false);
  });
});

describe("Admin can finish a stuck step", () => {
  it("is held to the photo check normally, and can force a step done when it is open", () => {
    const tplId = newTemplate("Sherwani");
    t.saveTemplate(tplId, [], t.rowsToStages([
      { key: "", label: "Cutting", photo: "none" },
      { key: "", label: "Embroidery", photo: "required" },
      { key: "", label: "Stitching", photo: "none" },
    ]));
    const snapshot = t.templateForItem(tplId)!.snapshot;
    const master = m.createMaster({ name: "M", pin: "1" });
    const orderId = o.createOrder(base(master), [{ templateId: tplId, label: "Sherwani", snapshot, values: {} }]);
    const itemId = o.listItems(orderId)[0].id;

    expect(s.completeStage({ by: "admin" }, itemId, "cutting")).toEqual({ ok: true });
    expect(s.completeStage({ by: "admin" }, itemId, "embroidery")).toEqual({ ok: false, reason: "needs-photo" });
    expect(s.completeStage({ by: "admin", force: true }, itemId, "stitching")).toEqual({ ok: false, reason: "not-open" }); // still locked
    expect(s.completeStage({ by: "admin", force: true }, itemId, "embroidery")).toEqual({ ok: true }); // no photo, forced
    expect(s.itemStageViews(itemId).map((v) => v.status)).toEqual(["done", "done", "open"]); // the next step opened
    // a master can never force
    expect(s.completeStage({ by: "master", masterId: master }, itemId, "stitching")).toEqual({ ok: true });
  });

  it("can also force past a mandatory field only the office could fill", () => {
    const tplId = newTemplate("Kurta");
    const fields = t.rowsToFields([rowOf("Fabric", "text", "admin")]);
    t.saveTemplate(tplId, fields, t.rowsToStages([{ key: "", label: "Cutting", photo: "none", requires: [fields[0].key] }]));
    const snapshot = t.templateForItem(tplId)!.snapshot;
    const master = m.createMaster({ name: "M", pin: "1" });
    const orderId = o.createOrder(base(master), [{ templateId: tplId, label: "Kurta", snapshot, values: {} }]);
    const itemId = o.listItems(orderId)[0].id;
    expect(s.completeStage({ by: "admin" }, itemId, "cutting")).toEqual({ ok: false, reason: "needs-fields" });
    expect(s.completeStage({ by: "admin", force: true }, itemId, "cutting")).toEqual({ ok: true });
  });
});

describe("what is waiting for the office", () => {
  it("lists an open step stuck on an office-only field, until it is filled or the order closes", () => {
    const tplId = newTemplate("Kurta");
    const fields = t.rowsToFields([rowOf("Chest", "number", "master"), rowOf("Fabric", "text", "admin")]);
    const [chest, fabric] = fields.map((f) => f.key);
    t.saveTemplate(tplId, fields, t.rowsToStages([{ key: "", label: "Cutting", photo: "none", requires: [chest, fabric] }]));
    const snapshot = t.templateForItem(tplId)!.snapshot;
    const master = m.createMaster({ name: "M", pin: "1" });
    const orderId = o.createOrder(base(master, "Waiting Customer"), [{ templateId: tplId, label: "Kurta", snapshot, values: {} }]);
    const itemId = o.listItems(orderId)[0].id;
    const mine = () => s.officeTodo().filter((x) => x.orderId === orderId);

    // Chest is the master's to fill, Fabric is the office's: only Fabric is "waiting for you"
    expect(mine()).toEqual([
      { orderId, orderNumber: o.getOrder(orderId)!.orderNumber, customerName: "Waiting Customer", itemLabel: "Kurta", stageLabel: "Cutting", fields: ["Fabric"] },
    ]);

    o.updateOrder(orderId, base(master, "Waiting Customer"), new Map([[itemId, { [fabric]: "silk" }]]));
    expect(mine()).toEqual([]); // the office part is done; Chest is now the master's job

    o.updateOrder(orderId, base(master, "Waiting Customer"), new Map([[itemId, {}]])); // cleared again
    expect(mine()).toHaveLength(1);
    o.setStatus(orderId, "cancelled");
    expect(mine()).toEqual([]); // a cancelled order waits for nobody
  });
});

describe("updating an existing order from its category", () => {
  it("copies the new form and steps in, keeping what is filled in and the steps already done", () => {
    const tplId = newTemplate("Sherwani");
    const f1 = t.rowsToFields([rowOf("Chest", "number", "master")]);
    t.saveTemplate(tplId, f1, t.rowsToStages([
      { key: "", label: "Cutting", photo: "none" },
      { key: "", label: "Embroidery", photo: "required" },
    ]));
    const snapshot = t.templateForItem(tplId)!.snapshot;
    const master = m.createMaster({ name: "M", pin: "1" });
    const orderId = o.createOrder(base(master), [{ templateId: tplId, label: "Sherwani", snapshot, values: { [f1[0].key]: "42" } }]);
    const item = () => o.listItems(orderId)[0];
    const itemId = item().id;
    expect(s.completeStage({ by: "master", masterId: master }, itemId, "cutting")).toEqual({ ok: true });
    expect(sync.categoryDiffers(item())).toBe(false);

    // the category changes: Embroidery no longer needs a photo, a Finishing step and a Neck field are added
    const f2 = t.rowsToFields([rowOf("Chest", "number", "master"), rowOf("Neck", "number", "master")]);
    f2[0].key = f1[0].key; // the same field keeps its key when it is edited in the builder
    t.saveTemplate(tplId, f2, t.rowsToStages([
      { key: "cutting", label: "Cutting", photo: "none" },
      { key: "embroidery", label: "Embroidery", photo: "none" },
      { key: "", label: "Finishing", photo: "none" },
    ]));
    expect(sync.categoryDiffers(item())).toBe(true);
    // before the update the old rule still holds: this order still needs the Embroidery photo
    expect(s.itemStageViews(itemId)[1].photo).toBe("required");

    expect(sync.refreshItemFromCategory(itemId)).toBe("ok");
    expect(sync.categoryDiffers(item())).toBe(false);
    const views = s.itemStageViews(itemId);
    expect(views.map((v) => [v.label, v.photo, v.status])).toEqual([
      ["Cutting", "none", "done"],
      ["Embroidery", "none", "open"],
      ["Finishing", "none", "locked"],
    ]);
    expect(item().snapshot.fields.map((f) => f.label)).toEqual(["Chest", "Neck"]);
    expect(item().values[f1[0].key]).toBe("42"); // what was typed is kept
    expect(s.completeStage({ by: "master", masterId: master }, itemId, "embroidery")).toEqual({ ok: true }); // no photo needed any more
  });

  it("removes a step that the category dropped and moves the order on", () => {
    const tplId = newTemplate("Pagri");
    t.saveTemplate(tplId, [], t.rowsToStages([{ key: "", label: "Dye", photo: "none" }, { key: "", label: "Fold", photo: "none" }]));
    const snapshot = t.templateForItem(tplId)!.snapshot;
    const master = m.createMaster({ name: "M", pin: "1" });
    const orderId = o.createOrder(base(master), [{ templateId: tplId, label: "Pagri", snapshot, values: {} }]);
    const itemId = o.listItems(orderId)[0].id;
    t.saveTemplate(tplId, [], t.rowsToStages([{ key: "fold", label: "Fold", photo: "none" }]));
    expect(sync.refreshItemFromCategory(itemId)).toBe("ok");
    expect(s.itemStageViews(itemId).map((v) => [v.label, v.status])).toEqual([["Fold", "open"]]);
  });

  it("says why it cannot update: no category, or the order is closed", () => {
    const tplId = newTemplate("Shoes");
    const snapshot = t.templateForItem(tplId)!.snapshot;
    const master = m.createMaster({ name: "M", pin: "1" });
    const orphan = o.createOrder(base(master), [{ templateId: 0, label: "Shoes", snapshot, values: {} }]);
    expect(sync.refreshItemFromCategory(o.listItems(orphan)[0].id)).toBe("no-category");
    const closed = o.createOrder(base(master), [{ templateId: tplId, label: "Shoes", snapshot, values: {} }]);
    o.setStatus(closed, "cancelled");
    expect(sync.refreshItemFromCategory(o.listItems(closed)[0].id)).toBe("closed");
    expect(sync.refreshItemFromCategory(999999)).toBe("not-found");
  });
});
