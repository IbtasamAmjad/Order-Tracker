import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

process.env.DATABASE_URL = ":memory:";

let t: typeof import("./templates");
let o: typeof import("./orders");
let m: typeof import("./masters");
let s: typeof import("./stages");
let h: typeof import("./history");
let tr: typeof import("./track");
let sh: typeof import("./shipping");

beforeAll(async () => {
  const { db } = await import("@/db");
  migrate(db, { migrationsFolder: "./drizzle" });
  t = await import("./templates");
  o = await import("./orders");
  m = await import("./masters");
  s = await import("./stages");
  h = await import("./history");
  tr = await import("./track");
  sh = await import("./shipping");
});

const file = { fileKey: "k", thumbKey: "t", bytes: 1 };
let seq = 0;
/** The Sherwani example from the client: Cutting, Embroidery (images matter), Stitching, Quality Check. */
function sherwani() {
  const main = t.createMainCategory("H" + ++seq, "#000000");
  t.createSubCategory(main, "Sherwani", "#111111");
  const tplId = t.listCategoryTree().find((c) => c.id === main)!.subs[0].template.id;
  t.saveTemplate(
    tplId,
    [],
    t.rowsToStages([
      { key: "", label: "Cutting", photo: "none" },
      { key: "", label: "Embroidery", photo: "upload" },
      { key: "", label: "Stitching", photo: "none" },
      { key: "", label: "Quality Check", photo: "optional" },
    ]),
  );
  return { tplId, snapshot: t.templateForItem(tplId)!.snapshot };
}
function order() {
  const k = sherwani();
  const master = m.createMaster({ name: "Naseem" + ++seq, pin: "1" });
  const orderId = o.createOrder({ customerName: "Zara", myDueDate: "2099-01-01", karigarDueDate: "2099-01-01", masterId: master, details: "" }, [
    { templateId: k.tplId, label: "Sherwani", snapshot: k.snapshot, values: {} },
  ]);
  return { master, orderId, itemId: o.listItems(orderId)[0].id, who: { by: "master", masterId: master } as const };
}

describe("order received: the master confirms he has seen the order", () => {
  it("cannot finish a step before confirming; the office can; confirming is remembered once", () => {
    const { master, orderId, itemId, who } = order();
    expect(s.completeStage(who, itemId, "cutting")).toEqual({ ok: false, reason: "not-confirmed" });
    // the progress bar starts at Order received
    expect(tr.orderTrack(orderId)[0]).toEqual({ label: "Order received", state: "current" });

    expect(h.confirmOrder(master, orderId)).toBe(true);
    expect(o.getOrder(orderId)!.confirmedBy).toBe(master);
    expect(tr.orderTrack(orderId)[0].state).toBe("done");
    expect(tr.orderTrack(orderId)[1]).toEqual({ label: "Cutting", state: "current" });
    expect(s.completeStage(who, itemId, "cutting")).toEqual({ ok: true });

    // pressing it again changes nothing and adds nothing
    const when = o.getOrder(orderId)!.confirmedAt!.getTime();
    h.confirmOrder(master, orderId);
    expect(o.getOrder(orderId)!.confirmedAt!.getTime()).toBe(when);
    expect(h.orderHistory(orderId).filter((x) => x.kind === "confirmed")).toHaveLength(1);

    // another master cannot confirm for him
    const stranger = m.createMaster({ name: "Stranger", pin: "2" });
    const other = order();
    expect(h.confirmOrder(stranger, other.orderId)).toBe(false);
  });
});

describe("images, notes and instructions on a step", () => {
  it("a step that needs an image cannot be finished without one (no approval needed)", () => {
    const { master, orderId, itemId, who } = order();
    h.confirmOrder(master, orderId);
    s.completeStage(who, itemId, "cutting");
    expect(s.completeStage(who, itemId, "embroidery")).toEqual({ ok: false, reason: "needs-photo" });
    expect(s.itemStageViews(itemId)[1].photoOk).toBe(false);
    s.addStagePhoto({ orderId, itemId, stageKey: "embroidery", uploadedBy: "master", ...file }); // still "pending": nobody has to approve it
    expect(s.itemStageViews(itemId)[1].photoOk).toBe(true);
    expect(s.completeStage(who, itemId, "embroidery")).toEqual({ ok: true });
    // and an item whose image step is done does not wait for the office to ship
    expect(sh.itemShipReadiness(itemId).blockers.join(";")).not.toMatch(/waiting for approval/);
  });

  it("the master and the office can write notes on a step; a locked step takes none from the master; empty notes are refused", () => {
    const { master, orderId, itemId, who } = order();
    h.confirmOrder(master, orderId);
    expect(h.addStageNote(who, itemId, "cutting", "  Cloth is 2 inches short  ")).toEqual({ ok: true });
    expect(h.addStageNote({ by: "admin" }, itemId, "cutting", "Use the new cloth")).toEqual({ ok: true });
    expect(h.addStageNote(who, itemId, "cutting", "   ")).toEqual({ ok: false, reason: "empty" });
    expect(h.addStageNote(who, itemId, "stitching", "too early")).toEqual({ ok: false, reason: "not-found" }); // still locked
    expect(h.addStageNote({ by: "admin" }, itemId, "stitching", "Remember the lining")).toEqual({ ok: true }); // the office may

    const notes = h.stageNotes(itemId);
    expect(notes.get("cutting")!.map((n) => [n.who, n.text])).toEqual([[expect.stringContaining("Naseem"), "Cloth is 2 inches short"], ["The office", "Use the new cloth"]]);
    expect(notes.get("stitching")!.map((n) => n.text)).toEqual(["Remember the lining"]);
    // another master cannot write on it
    const stranger = m.createMaster({ name: "Stranger2", pin: "3" });
    expect(h.addStageNote({ by: "master", masterId: stranger }, itemId, "cutting", "hello")).toEqual({ ok: false, reason: "not-found" });
  });

  it("the office leaves an instruction for a step; the master is told it changed; removing it is recorded", () => {
    const { orderId, itemId } = order();
    expect(h.setInstruction(itemId, "embroidery", "Gold thread only")).toBe(true);
    expect(h.stageInstructions(itemId).get("embroidery")).toBe("Gold thread only");
    expect(o.getOrder(orderId)!.changedForMasterAt).not.toBeNull(); // the master sees "Updated"
    expect(s.itemStageViews(itemId)[1].key).toBe("embroidery");

    h.setInstruction(itemId, "embroidery", "Gold thread only"); // same text: nothing new in the history
    expect(h.orderHistory(orderId).filter((x) => x.kind === "instruction")).toHaveLength(1);
    h.setInstruction(itemId, "embroidery", "");
    expect(h.stageInstructions(itemId).has("embroidery")).toBe(false);
    expect(h.orderHistory(orderId).filter((x) => x.kind === "instruction").map((x) => x.text)).toEqual(["(instruction removed)", "Gold thread only"]);
  });
});

describe("the history of an order", () => {
  it("keeps who did what and when, newest first, in plain words", () => {
    const { master, orderId, itemId, who } = order();
    h.setInstruction(itemId, "cutting", "Cut on the left");
    h.confirmOrder(master, orderId);
    h.addStageNote(who, itemId, "cutting", "Started");
    s.completeStage(who, itemId, "cutting");
    s.addStagePhoto({ orderId, itemId, stageKey: "embroidery", uploadedBy: "master", ...file });
    s.completeStage({ by: "admin" }, itemId, "embroidery");

    const lines = h.orderHistory(orderId);
    expect(lines.map((l) => l.kind)).toEqual(["done", "image", "done", "note", "confirmed", "instruction"]); // newest first
    const text = lines.map((l) => h.describeEvent(l));
    expect(text[0]).toBe("The office finished Embroidery (Sherwani)");
    expect(text[2]).toMatch(/^Naseem\d+ finished Cutting \(Sherwani\)$/);
    expect(text[4]).toMatch(/confirmed they have seen the order$/);
    expect(lines.every((l) => l.at instanceof Date)).toBe(true);
  });

  it("records an item being sent, and removing an item takes its history with it", () => {
    const { master, orderId, itemId, who } = order();
    h.confirmOrder(master, orderId);
    s.completeStage(who, itemId, "cutting");
    s.addStagePhoto({ orderId, itemId, stageKey: "embroidery", uploadedBy: "master", ...file });
    for (const key of ["embroidery", "stitching", "quality_check"]) s.completeStage(who, itemId, key);
    const sid = sh.startShipment(master, orderId)!;
    sh.saveShipmentItems(master, sid, [itemId], [itemId]);
    sh.attachShipmentPhoto({ id: sid, orderId }, "bill", file);
    expect(sh.submitShipment(master, sid)).toEqual({ ok: true, orderCompleted: true });
    expect(h.orderHistory(orderId)[0]).toMatchObject({ kind: "shipped", item: "Sherwani" });
    expect(h.describeEvent(h.orderHistory(orderId)[0])).toMatch(/sent Sherwani$/);

    // an item that was never sent can be removed with its history
    const b = order();
    h.addStageNote({ by: "admin" }, b.itemId, "cutting", "note");
    expect(o.removeItem(b.orderId, b.itemId)).toEqual({ ok: true });
    expect(h.orderHistory(b.orderId).filter((l) => l.kind === "note")).toHaveLength(0);
  });
});
