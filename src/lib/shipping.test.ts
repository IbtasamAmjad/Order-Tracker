import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

process.env.DATABASE_URL = ":memory:";

let t: typeof import("./templates");
let o: typeof import("./orders");
let h: typeof import("./history");
let m: typeof import("./masters");
let sh: typeof import("./shipping");
let s: typeof import("./stages");

beforeAll(async () => {
  const { db } = await import("@/db");
  migrate(db, { migrationsFolder: "./drizzle" });
  t = await import("./templates");
  o = await import("./orders");
  h = await import("./history");
  m = await import("./masters");
  sh = await import("./shipping");
  s = await import("./stages");
});

const file = { fileKey: "k", thumbKey: "t", bytes: 1 };

/** An order with n items for a fresh master. */
function setup(n: number, masterId?: number) {
  const main = t.createMainCategory("S" + Math.random(), "#000000");
  t.createSubCategory(main, "Sherwani", "#111111");
  const tplId = t.listCategoryTree().find((c) => c.id === main)!.subs[0].template.id;
  const snapshot = t.templateForItem(tplId)!.snapshot;
  const master = masterId ?? m.createMaster({ name: "M" + Math.random(), pin: "1" });
  const orderId = o.createOrder(
    { customerName: "C", myDueDate: "2099-01-01", karigarDueDate: "2099-01-01", masterId: master, details: "" },
    Array.from({ length: n }, (_, i) => ({ templateId: tplId, label: `Sherwani ${i + 1}`, snapshot, values: {} })),
  );
  h.confirmOrder(master, orderId);
  return { master, orderId, itemIds: o.listItems(orderId).map((i) => i.id) };
}

describe("shipping", () => {
  it("blocks submit until items are ticked and the bill is uploaded; one bill covers five Sherwanis", () => {
    const { master, orderId, itemIds } = setup(5);
    const sid = sh.startShipment(master, orderId)!;
    expect(sh.startShipment(master, orderId)).toBe(sid); // reuses the open draft

    expect(sh.submitShipment(master, sid)).toEqual({ ok: false, reason: "no-items" });
    sh.saveShipmentItems(master, sid, itemIds, itemIds.slice(0, 4)); // only 4 of 5 ticked as present
    expect(sh.submitShipment(master, sid)).toEqual({ ok: false, reason: "unchecked" });
    sh.saveShipmentItems(master, sid, itemIds, itemIds); // all ticked
    expect(sh.submitShipment(master, sid)).toEqual({ ok: false, reason: "no-bill" });

    sh.attachShipmentPhoto({ id: sid, orderId }, "bill", file);
    sh.attachShipmentPhoto({ id: sid, orderId }, "package", file); // optional proof
    expect(sh.shipmentRequirements(sh.shipmentView(sid)!)).toEqual({ hasItems: true, allChecked: true, hasBill: true });

    expect(sh.submitShipment(master, sid)).toEqual({ ok: true, orderCompleted: true });
    const v = sh.shipmentView(sid)!;
    expect(v.status).toBe("submitted");
    expect(v.items).toHaveLength(5); // all five recorded with the one bill
    expect(v.billPhotoId).not.toBeNull();
    expect(v.packagePhotoId).not.toBeNull();
    expect(o.getOrder(orderId)!.status).toBe("completed"); // everything shipped
    expect(sh.submitShipment(master, sid)).toEqual({ ok: false, reason: "not-draft" });
  });

  it("allows partial shipments; an item can be in only one submitted shipment", () => {
    const { master, orderId, itemIds } = setup(3);
    const a = sh.startShipment(master, orderId)!;
    sh.saveShipmentItems(master, a, [itemIds[0], itemIds[1]], [itemIds[0], itemIds[1]]);
    sh.attachShipmentPhoto({ id: a, orderId }, "bill", file);
    expect(sh.submitShipment(master, a)).toEqual({ ok: true, orderCompleted: false });
    expect(o.getOrder(orderId)!.status).toBe("active"); // one item still to ship

    // already-shipped items are ignored when choosing items for the next shipment
    const b = sh.startShipment(master, orderId)!;
    expect(b).not.toBe(a);
    sh.saveShipmentItems(master, b, itemIds, itemIds);
    expect(sh.shipmentView(b)!.items.map((i) => i.itemId)).toEqual([itemIds[2]]);
    expect(sh.shippableItems(orderId).filter((i) => i.shippedIn !== null)).toHaveLength(2);

    sh.attachShipmentPhoto({ id: b, orderId }, "bill", file);
    expect(sh.submitShipment(master, b)).toEqual({ ok: true, orderCompleted: true });
  });

  it("only the owner can use a shipment, and a master can send any of his orders", () => {
    const first = setup(1);
    const second = setup(1, first.master); // same master, later in his list
    const other = m.createMaster({ name: "Other", pin: "2" });
    expect(sh.startShipment(other, first.orderId)).toBeNull();

    const sid = sh.startShipment(first.master, second.orderId)!;
    expect(sh.masterShipment(other, sid)).toBeNull();
    expect(sh.saveShipmentItems(other, sid, second.itemIds, second.itemIds)).toBe(false);
    expect(sh.canUploadShipmentPhoto(other, sid)).toBeNull();
    expect(sh.canUploadShipmentPhoto(first.master, sid)).not.toBeNull();

    sh.saveShipmentItems(first.master, sid, second.itemIds, second.itemIds);
    sh.attachShipmentPhoto({ id: sid, orderId: second.orderId }, "bill", file);
    expect(sh.submitShipment(first.master, sid)).toEqual({ ok: true, orderCompleted: true });
  });

  it("alerts Admin about new shipments until they are seen; bills are served only to the owning master", () => {
    const { master, orderId, itemIds } = setup(1);
    const before = sh.unseenShipmentCount();
    const sid = sh.startShipment(master, orderId)!;
    sh.saveShipmentItems(master, sid, itemIds, itemIds);
    const billId = sh.attachShipmentPhoto({ id: sid, orderId }, "bill", file);
    sh.submitShipment(master, sid);
    expect(sh.unseenShipmentCount()).toBe(before + 1);
    const row = sh.submittedShipmentsForAdmin().find((x) => x.id === sid)!;
    expect(row).toMatchObject({ isNew: true, billPhotoId: billId });
    sh.markShipmentsSeen([sid]);
    expect(sh.unseenShipmentCount()).toBe(before);

    const other = m.createMaster({ name: "Other2", pin: "2" });
    expect(s.photoForMaster(master, billId)?.id).toBe(billId);
    expect(s.photoForMaster(other, billId)).toBeNull();
  });
});

describe("shipping waits for photo approval", () => {
  /** One Sherwani whose category has two steps: Cutting (no photo) and Embroidery (photo you must approve). */
  async function stagedOrder() {
    const main = t.createMainCategory("P" + Math.random(), "#000000");
    t.createSubCategory(main, "Sherwani", "#111111");
    const tplId = t.listCategoryTree().find((c) => c.id === main)!.subs[0].template.id;
    t.saveTemplate(tplId, [], t.rowsToStages([
      { key: "", label: "Cutting", photo: "none" },
      { key: "", label: "Embroidery", photo: "required" },
    ]));
    const snapshot = t.templateForItem(tplId)!.snapshot;
    const master = m.createMaster({ name: "M" + Math.random(), pin: "1" });
    const orderId = o.createOrder(
      { customerName: "C", myDueDate: "2099-01-01", karigarDueDate: "2099-01-01", masterId: master, details: "" },
      [{ templateId: tplId, label: "Sherwani", snapshot, values: {} }],
    );
    h.confirmOrder(master, orderId);
    const itemId = o.listItems(orderId)[0].id;
    return { master, orderId, itemId, who: { by: "master", masterId: master } as const };
  }
  const stagePhoto = (orderId: number, itemId: number) =>
    s.addStagePhoto({ orderId, itemId, stageKey: "embroidery", uploadedBy: "master", fileKey: "k", thumbKey: "t", bytes: 1 });

  it("cannot ship until the steps are done and the photo is approved", async () => {
    const { master, orderId, itemId, who } = await stagedOrder();
    const blockers = () => sh.itemShipReadiness(itemId).blockers;

    expect(sh.itemShipReadiness(itemId).ready).toBe(false);
    expect(blockers()).toEqual(["Cutting: not finished yet", "Embroidery: a photo is needed and must be approved"]);

    // a draft refuses an item that is not ready
    const sid = sh.startShipment(master, orderId)!;
    sh.saveShipmentItems(master, sid, [itemId], [itemId]);
    expect(sh.shipmentView(sid)!.items).toHaveLength(0);
    expect(sh.shippableItems(orderId)[0]).toMatchObject({ ready: false });

    expect(s.completeStage(who, itemId, "cutting")).toEqual({ ok: true });
    expect(blockers()).toEqual(["Embroidery: a photo is needed and must be approved"]);

    const p1 = stagePhoto(orderId, itemId); // the karigar sends the picture for approval
    expect(blockers()).toEqual(["Embroidery: the photo is waiting for approval"]);
    s.reviewPhoto(p1, "rejected", "Wrong thread");
    expect(blockers()).toEqual(["Embroidery: the photo was rejected, send a new one"]);

    const p2 = stagePhoto(orderId, itemId);
    s.reviewPhoto(p2, "approved", "");
    // approval is enough: the master does not also have to press "Mark complete" before the item can ship
    expect(sh.itemShipReadiness(itemId)).toEqual({ ready: true, blockers: [] });
    expect(s.completeStage(who, itemId, "embroidery")).toEqual({ ok: true });
    expect(sh.itemShipReadiness(itemId)).toEqual({ ready: true, blockers: [] });
    sh.saveShipmentItems(master, sid, [itemId], [itemId]);
    sh.attachShipmentPhoto({ id: sid, orderId }, "bill", file);
    expect(sh.submitShipment(master, sid)).toEqual({ ok: true, orderCompleted: true });
  });

  it("submit refuses an item that stopped being ready, and a finished step with an optional image is ready", async () => {
    const { master, orderId, itemId, who } = await stagedOrder();
    const { db } = await import("@/db");
    const { shipmentItems } = await import("@/db/schema");
    const sid = sh.startShipment(master, orderId)!;
    db.insert(shipmentItems).values({ shipmentId: sid, itemId, checked: true }).run(); // as if added before it became unready
    sh.attachShipmentPhoto({ id: sid, orderId }, "bill", file);
    expect(sh.submitShipment(master, sid)).toEqual({ ok: false, reason: "not-ready" });

    // optional-photo step: an image the master added does not hold the item back once the step is finished
    const main = t.createMainCategory("Q" + Math.random(), "#000000");
    t.createSubCategory(main, "Kurta", "#111111");
    const tplId = t.listCategoryTree().find((c) => c.id === main)!.subs[0].template.id;
    t.saveTemplate(tplId, [], t.rowsToStages([{ key: "", label: "Finishing", photo: "optional" }]));
    const snapshot = t.templateForItem(tplId)!.snapshot;
    const order2 = o.createOrder(
      { customerName: "C2", myDueDate: "2099-01-01", karigarDueDate: "2099-01-01", masterId: master, details: "" },
      [{ templateId: tplId, label: "Kurta", snapshot, values: {} }],
    );
    h.confirmOrder(master, order2);
    const item2 = o.listItems(order2)[0].id;
    const pid = s.addStagePhoto({ orderId: order2, itemId: item2, stageKey: "finishing", uploadedBy: "master", fileKey: "k", thumbKey: "t", bytes: 1 });
    o.setAllowOutOfSequence(order2, true);
    expect(s.completeStage(who, item2, "finishing")).toEqual({ ok: true });
    // an image on an optional step does not wait for Admin: the finished step is enough
    expect(sh.itemShipReadiness(item2).ready).toBe(true);
    s.reviewPhoto(pid, "approved", ""); // and if Admin does decide, nothing changes
    expect(sh.itemShipReadiness(item2).ready).toBe(true);
  });
});

describe("shipping with mandatory fields", () => {
  const rowOf = (label: string, type: string, who: string) => ({ key: "", label, type, required: "optional", unit: "", options: "", who });

  it("an approved photo is not enough while a mandatory field is empty, and the message says who fills it", () => {
    const main = t.createMainCategory("M" + Math.random(), "#000000");
    t.createSubCategory(main, "Kurta", "#111111");
    const tplId = t.listCategoryTree().find((c) => c.id === main)!.subs[0].template.id;
    const fields = t.rowsToFields([rowOf("Text box", "text", "master"), rowOf("Picture", "picture", "admin")]);
    const [text, picture] = fields.map((f) => f.key);
    t.saveTemplate(tplId, fields, t.rowsToStages([{ key: "", label: "Upload picture", photo: "required", requires: [text, picture] }]));
    const snapshot = t.templateForItem(tplId)!.snapshot;
    const master = m.createMaster({ name: "M" + Math.random(), pin: "1" });
    const orderId = o.createOrder(
      { customerName: "C", myDueDate: "2099-01-01", karigarDueDate: "2099-01-01", masterId: master, details: "" },
      [{ templateId: tplId, label: "Kurta", snapshot, values: {} }],
    );
    h.confirmOrder(master, orderId);
    const itemId = o.listItems(orderId)[0].id;

    // the master sends the step photo and Admin approves it
    const pid = s.addStagePhoto({ orderId, itemId, stageKey: "upload_picture", uploadedBy: "master", fileKey: "k", thumbKey: "t", bytes: 1 });
    s.reviewPhoto(pid, "approved", "");
    o.masterSaveFields(master, orderId, itemId, { [text]: "done" });

    // still blocked: the Picture field is empty and only the office can fill it
    expect(sh.itemShipReadiness(itemId)).toEqual({
      ready: false,
      blockers: ["Upload picture: still to fill in: Picture (the office fills this in)"],
    });

    // Admin attaches the picture: now the approved photo is enough
    s.addReferencePhoto({ orderId, itemId, fieldKey: picture, fileKey: "k", thumbKey: "t", bytes: 1 });
    expect(sh.itemShipReadiness(itemId)).toEqual({ ready: true, blockers: [] });
  });
  it("one cart and one bill cover finished items from several customers", () => {
    const a = setup(2);
    const b = setup(1, a.master);
    const c = setup(1, a.master);
    const master = a.master;
    expect(sh.cartCandidates(master)).toHaveLength(4);

    // another master cannot put these in his cart
    const other = m.createMaster({ name: "Other", pin: "9" });
    expect(sh.addToCart(other, a.itemIds[0])).toBe(false);

    expect(sh.addToCart(master, a.itemIds[0])).toBe(true);
    expect(sh.addToCart(master, a.itemIds[0])).toBe(true); // twice: still one
    expect(sh.addToCart(master, b.itemIds[0])).toBe(true);
    expect(sh.addToCart(master, c.itemIds[0])).toBe(true);
    expect(sh.removeFromCart(master, c.itemIds[0])).toBe(true);
    expect(sh.addToCart(master, c.itemIds[0])).toBe(true);

    const cart = sh.findDraft(master)!;
    expect(cart.items.map((i) => i.itemId).sort()).toEqual([a.itemIds[0], b.itemIds[0], c.itemIds[0]].sort());
    expect(new Set(cart.items.map((i) => i.orderId)).size).toBe(3); // three customers, one shipment

    expect(sh.submitShipment(master, cart.id)).toEqual({ ok: false, reason: "no-bill" });
    sh.attachShipmentPhoto({ id: cart.id, orderId: cart.orderId }, "bill", file); // the one bill
    expect(sh.submitShipment(master, cart.id)).toEqual({ ok: true, orderCompleted: true });

    // the two orders that were fully sent are completed; the one with an item left is still active
    expect(o.getOrder(b.orderId)!.status).toBe("completed");
    expect(o.getOrder(c.orderId)!.status).toBe("completed");
    expect(o.getOrder(a.orderId)!.status).toBe("active");
    expect(sh.cartCandidates(master).map((x) => x.itemId)).toEqual([a.itemIds[1]]); // what is left to send

    // admin: one shipment, three customers; an order sees only its own items
    const mine = sh.submittedShipmentsForAdmin().find((x) => x.id === cart.id)!;
    expect(new Set(mine.items.map((i) => i.customerName)).size).toBeGreaterThan(0);
    expect(mine.items).toHaveLength(3);
    expect(sh.orderShipments(b.orderId, "submitted").map((x) => x.items.map((i) => i.itemId))).toEqual([[b.itemIds[0]]]);
  });
});
