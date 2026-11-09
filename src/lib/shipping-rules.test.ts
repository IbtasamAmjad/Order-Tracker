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
const base = (masterId: number, name = "C") => ({
  customerName: name, myDueDate: "2099-01-01", karigarDueDate: "2099-01-01", masterId, details: "",
});
function category(name: string, stages: { label: string; photo: string }[] = []) {
  const main = t.createMainCategory("S" + Math.random(), "#000000");
  t.createSubCategory(main, name, "#111111");
  const tplId = t.listCategoryTree().find((c) => c.id === main)!.subs[0].template.id;
  if (stages.length) t.saveTemplate(tplId, [], t.rowsToStages(stages.map((x) => ({ key: "", ...x }))));
  return { tplId, snapshot: t.templateForItem(tplId)!.snapshot };
}

describe("the master's Mark complete cannot skip shipping", () => {
  it("refuses while items are unsent, and the order closes by shipping", () => {
    const { tplId, snapshot } = category("Sherwani");
    const master = m.createMaster({ name: "M", pin: "1" });
    const orderId = o.createOrder(base(master), [
      { templateId: tplId, label: "Sherwani 1", snapshot, values: {} },
      { templateId: tplId, label: "Sherwani 2", snapshot, values: {} },
    ]);
    h.confirmOrder(master, orderId);
    const ids = o.listItems(orderId).map((i) => i.id);
    expect(o.masterComplete(master, orderId)).toEqual({ ok: false, reason: "not-shipped" });

    // one item sent: still not allowed
    const s1 = sh.startShipment(master, orderId)!;
    sh.saveShipmentItems(master, s1, [ids[0]], [ids[0]]);
    sh.attachShipmentPhoto({ id: s1, orderId }, "bill", file);
    expect(sh.submitShipment(master, s1)).toEqual({ ok: true, orderCompleted: false });
    expect(o.masterComplete(master, orderId)).toEqual({ ok: false, reason: "not-shipped" });
    expect(o.getOrder(orderId)!.status).toBe("active");

    // the last item sent: shipping itself completes the order
    const s2 = sh.startShipment(master, orderId)!;
    sh.saveShipmentItems(master, s2, [ids[1]], [ids[1]]);
    sh.attachShipmentPhoto({ id: s2, orderId }, "bill", file);
    expect(sh.submitShipment(master, s2)).toEqual({ ok: true, orderCompleted: true });
    expect(o.getOrder(orderId)!.status).toBe("completed");
  });

  it("still lets the master close an order that has no items (nothing to ship)", () => {
    const master = m.createMaster({ name: "M", pin: "1" });
    const orderId = o.createOrder(base(master), []);
    h.confirmOrder(master, orderId);
    expect(o.masterComplete(master, orderId)).toEqual({ ok: true });
    expect(o.getOrder(orderId)!.status).toBe("completed");
  });
});

describe("shipping order: no order holds back another", () => {
  it("lets a later order ship whether or not the earlier one has something ready", () => {
    const staged = category("Sherwani", [{ label: "Embroidery", photo: "required" }]);
    const plain = category("Pagri");
    const master = m.createMaster({ name: "M", pin: "1" });
    const first = o.createOrder(base(master, "First"), [{ templateId: staged.tplId, label: "Sherwani", snapshot: staged.snapshot, values: {} }]);
    h.confirmOrder(master, first);
    const second = o.createOrder(base(master, "Second"), [{ templateId: plain.tplId, label: "Pagri", snapshot: plain.snapshot, values: {} }]);
    h.confirmOrder(master, second);
    const firstItem = o.listItems(first)[0].id;

    expect(sh.canMasterShip(master, first)).toBe(true);
    // the first order waits for Anas to approve a photo: nothing in it is ready, so the second may go
    s.addStagePhoto({ orderId: first, itemId: firstItem, stageKey: "embroidery", uploadedBy: "master", ...file });
    expect(sh.itemShipReadiness(firstItem).ready).toBe(false);
    expect(sh.canMasterShip(master, second)).toBe(true);

    // once Anas approves it, the first order has something to send, and the second may still go
    const pid = s.pendingPhotos().find((p) => p.orderNumber === o.getOrder(first)!.orderNumber)!.id;
    s.reviewPhoto(pid, "approved", "");
    expect(sh.itemShipReadiness(firstItem).ready).toBe(true);
    expect(sh.canMasterShip(master, second)).toBe(true);
  });

  it("submit works on a later order while an earlier one is ready", () => {
    const plain = category("Pagri");
    const master = m.createMaster({ name: "M", pin: "1" });
    const first = o.createOrder(base(master, "First"), [{ templateId: plain.tplId, label: "Pagri", snapshot: plain.snapshot, values: {} }]);
    h.confirmOrder(master, first);
    const second = o.createOrder(base(master, "Second"), [{ templateId: plain.tplId, label: "Pagri", snapshot: plain.snapshot, values: {} }]);
    h.confirmOrder(master, second);
    expect(first).toBeLessThan(second);
    const sid = sh.startShipment(master, second)!;
    const item = o.listItems(second)[0].id;
    sh.saveShipmentItems(master, sid, [item], [item]);
    sh.attachShipmentPhoto({ id: sid, orderId: second }, "bill", file);
    expect(sh.submitShipment(master, sid)).toEqual({ ok: true, orderCompleted: true });
  });
});

describe("looking at the shipping page does not create a shipment", () => {
  it("finds no draft until one is started, then finds the same one", () => {
    const plain = category("Pagri");
    const master = m.createMaster({ name: "M", pin: "1" });
    const orderId = o.createOrder(base(master), [{ templateId: plain.tplId, label: "Pagri", snapshot: plain.snapshot, values: {} }]);
    h.confirmOrder(master, orderId);
    expect(sh.findDraft(master, orderId)).toBeNull();
    expect(sh.findDraft(master, orderId)).toBeNull(); // asking again changes nothing
    expect(sh.orderShipments(orderId)).toHaveLength(0);
    const sid = sh.startShipment(master, orderId)!;
    expect(sh.findDraft(master, orderId)?.id).toBe(sid);
    const other = m.createMaster({ name: "Other", pin: "2" });
    expect(sh.findDraft(other, orderId)).toBeNull(); // another master never sees it
  });
});

describe("removing an item from a customer", () => {
  it("removes an unsent item with its steps, keeps a sent one, and completes the customer when the rest is sent", () => {
    const staged = category("Sherwani", [{ label: "Embroidery", photo: "optional" }]);
    const master = m.createMaster({ name: "M", pin: "1" });
    const orderId = o.createOrder(base(master), [
      { templateId: staged.tplId, label: "Sherwani 1", snapshot: staged.snapshot, values: {} },
      { templateId: staged.tplId, label: "Sherwani 2", snapshot: staged.snapshot, values: {} },
      { templateId: staged.tplId, label: "Sherwani 3", snapshot: staged.snapshot, values: {} },
    ]);
    h.confirmOrder(master, orderId);
    const [a, b, c] = o.listItems(orderId).map((i) => i.id);
    s.addReferencePhoto({ orderId, itemId: c, fieldKey: "x", ...file });

    // the third goes, with its steps and pictures
    expect(o.removeItem(orderId, c)).toEqual({ ok: true });
    expect(o.listItems(orderId).map((i) => i.id)).toEqual([a, b]);
    expect(s.referencePhotos(c)).toHaveLength(0);
    expect(s.itemStageViews(c)).toHaveLength(0);
    expect(o.removeItem(orderId, c)).toEqual({ ok: false, reason: "not-found" });

    // send the first: it can no longer be removed
    s.completeStage({ by: "admin" }, a, "embroidery");
    const sid = sh.startShipment(master, orderId)!;
    sh.saveShipmentItems(master, sid, [a], [a]);
    sh.attachShipmentPhoto({ id: sid, orderId }, "bill", file);
    expect(sh.submitShipment(master, sid)).toEqual({ ok: true, orderCompleted: false });
    expect(o.removeItem(orderId, a)).toEqual({ ok: false, reason: "shipped" });

    // removing the only unsent item leaves everything sent, so the customer is complete
    expect(o.removeItem(orderId, b)).toEqual({ ok: true });
    expect(o.getOrder(orderId)!.status).toBe("completed");
    expect(o.removeItem(orderId, a)).toEqual({ ok: false, reason: "order-closed" });
  });
});

describe("the progress bar of an order", () => {
  it("runs Order received, the steps, Shipped, and moves on as work is done and sent", async () => {
    const { orderTrack, itemTrack } = await import("./track");
    const staged = category("Sherwani", [
      { label: "Embroidery", photo: "none" },
      { label: "Stitching", photo: "none" },
    ]);
    const master = m.createMaster({ name: "M", pin: "1" });
    const orderId = o.createOrder(base(master), [
      { templateId: staged.tplId, label: "Sherwani 1", snapshot: staged.snapshot, values: {} },
      { templateId: staged.tplId, label: "Sherwani 2", snapshot: staged.snapshot, values: {} },
    ]);
    h.confirmOrder(master, orderId);
    const [a, b] = o.listItems(orderId).map((i) => i.id);
    const states = () => orderTrack(orderId).map((x) => `${x.label}:${x.state}`).join(" | ");

    // the same step on two items is one step on the bar
    expect(states()).toBe("Order received:done | Embroidery:current | Stitching:todo | Shipped:todo");

    // done only when every item has finished it
    s.completeStage({ by: "admin" }, a, "embroidery");
    expect(states()).toBe("Order received:done | Embroidery:current | Stitching:todo | Shipped:todo");
    s.completeStage({ by: "admin" }, b, "embroidery");
    expect(states()).toBe("Order received:done | Embroidery:done | Stitching:current | Shipped:todo");
    expect(itemTrack(a).map((x) => x.state)).toEqual(["done", "done", "current", "todo"]);

    // finish and send everything
    for (const id of [a, b]) s.completeStage({ by: "admin" }, id, "stitching");
    expect(states()).toBe("Order received:done | Embroidery:done | Stitching:done | Shipped:current");
    const sid = sh.startShipment(master, orderId)!;
    sh.saveShipmentItems(master, sid, [a, b], [a, b]);
    sh.attachShipmentPhoto({ id: sid, orderId }, "bill", file);
    expect(sh.submitShipment(master, sid)).toEqual({ ok: true, orderCompleted: true });
    expect(states()).toBe("Order received:done | Embroidery:done | Stitching:done | Shipped:done");
  });

  it("an order with no steps is just Order received and Shipped", async () => {
    const { orderTrack } = await import("./track");
    const plain = category("Pagri");
    const master = m.createMaster({ name: "M", pin: "1" });
    const orderId = o.createOrder(base(master), [{ templateId: plain.tplId, label: "Pagri", snapshot: plain.snapshot, values: {} }]);
    h.confirmOrder(master, orderId);
    expect(orderTrack(orderId).map((x) => x.label)).toEqual(["Order received", "Shipped"]);
  });
});

describe("an image on an optional step does not wait for approval", () => {
  it("is not a blocker, while a required photo still is", () => {
    const optional = category("Sherwani", [{ label: "Embroidery", photo: "optional" }]);
    const required = category("Pants", [{ label: "Embroidery", photo: "required" }]);
    const master = m.createMaster({ name: "M", pin: "1" });
    const orderId = o.createOrder(base(master), [
      { templateId: optional.tplId, label: "Sherwani", snapshot: optional.snapshot, values: {} },
      { templateId: required.tplId, label: "Pants", snapshot: required.snapshot, values: {} },
    ]);
    h.confirmOrder(master, orderId);
    const [a, p] = o.listItems(orderId).map((i) => i.id);
    s.addStagePhoto({ orderId, itemId: a, stageKey: "embroidery", uploadedBy: "master", ...file });
    s.addStagePhoto({ orderId, itemId: p, stageKey: "embroidery", uploadedBy: "master", ...file });

    // optional: it only says the step is not finished (the master can finish it himself)
    expect(sh.itemShipReadiness(a).blockers).toEqual(["Embroidery: not finished yet"]);
    // required: it waits for Admin
    expect(sh.itemShipReadiness(p).blockers).toEqual(["Embroidery: the photo is waiting for approval"]);

    // the master finishes the optional step and the Sherwani is ready, with the image still "pending"
    expect(s.completeStage({ by: "master", masterId: master }, a, "embroidery")).toEqual({ ok: true });
    expect(sh.itemShipReadiness(a).ready).toBe(true);
  });
});
