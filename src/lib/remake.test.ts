import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

process.env.DATABASE_URL = ":memory:";

let t: typeof import("./templates");
let o: typeof import("./orders");
let m: typeof import("./masters");
let s: typeof import("./stages");
let sh: typeof import("./shipping");
let h: typeof import("./history");
let r: typeof import("./remake");
let q: typeof import("./item-search");

beforeAll(async () => {
  const { db } = await import("@/db");
  migrate(db, { migrationsFolder: "./drizzle" });
  t = await import("./templates");
  o = await import("./orders");
  m = await import("./masters");
  s = await import("./stages");
  sh = await import("./shipping");
  h = await import("./history");
  r = await import("./remake");
  q = await import("./item-search");
});

const file = { fileKey: "k", thumbKey: "t", bytes: 1 };

/** An order with two Shoes, each with two steps. */
function setup() {
  const main = t.createMainCategory("R" + Math.random(), "#000000");
  t.createSubCategory(main, "Shoes", "#111111");
  const tplId = t.listCategoryTree().find((c) => c.id === main)!.subs[0].template.id;
  t.saveTemplate(tplId, t.rowsToFields([]), t.rowsToStages([{ key: "", label: "Making", photo: "none" }, { key: "", label: "Final check", photo: "none" }]));
  const snapshot = t.templateForItem(tplId)!.snapshot;
  const master = m.createMaster({ name: "Rm" + Math.random(), pin: "1" });
  const orderId = o.createOrder(
    { customerName: "Remake Customer", myDueDate: "2000-01-01", karigarDueDate: "2000-01-01", masterId: master, details: "" },
    [1, 2].map((n) => ({ templateId: tplId, label: `Shoes ${n}`, snapshot, values: {} })),
  );
  h.confirmOrder(master, orderId);
  const [a, b] = o.listItems(orderId).map((i) => i.id);
  return { master, orderId, a, b };
}
const finish = (id: number) => {
  for (const k of ["making", "final_check"]) s.completeStage({ by: "admin" }, id, k);
};
const send = (master: number, ids: number[]) => {
  for (const id of ids) expect(sh.addToCart(master, id)).toBe(true);
  const cart = sh.findDraft(master)!;
  sh.attachShipmentPhoto({ id: cart.id, orderId: cart.orderId }, "bill", file);
  return sh.submitShipment(master, cart.id);
};

describe("sending an item back for a remake", () => {
  it("restarts only the chosen item, keeps the due date, and lets it be sent again", () => {
    const { master, orderId, a, b } = setup();
    finish(a);
    finish(b);
    expect(send(master, [a, b])).toEqual({ ok: true, orderCompleted: true });
    expect(o.getOrder(orderId)!.status).toBe("completed");

    const due = o.getOrder(orderId)!.karigarDueDate;
    expect(r.remakeItems(orderId, [a], "Wrong size, remake")).toEqual({ ok: true, count: 1 });

    // the order is live again and still has its original due date, so it is late
    const order = o.getOrder(orderId)!;
    expect(order.status).toBe("active");
    expect(order.karigarDueDate).toBe(due);
    expect(o.listAdminOrders({ view: "active" })[0].id).toBe(orderId); // on top of the list
    expect(o.listAdminOrders({ view: "active" })[0].flags?.overdue).toBe(true);

    // only the chosen item starts again; the steps restart from the first one
    expect(s.itemStageViews(a).map((x) => x.status)).toEqual(["open", "locked"]);
    expect(s.itemStageViews(b).map((x) => x.status)).toEqual(["done", "done"]);
    const shipped = sh.shippableItems(orderId);
    expect(shipped.find((x) => x.id === a)!.shippedIn).toBeNull();
    expect(shipped.find((x) => x.id === b)!.shippedIn).not.toBeNull(); // the other item is still sent
    expect(q.itemRows(master).find((x) => x.itemId === a)!.status).toBe("not-started");
    expect(q.itemRows(master).find((x) => x.itemId === b)!.status).toBe("shipped");
    expect(sh.cartCandidates(master)).toEqual([]); // not finished yet, so nothing to send

    // the reason is in the history and is the instruction on the first step
    expect(r.remakeCount(a)).toBe(1);
    expect(r.remakeCount(b)).toBe(0);
    expect(h.orderHistory(orderId).some((e) => e.kind === "remade" && e.text === "Wrong size, remake")).toBe(true);
    expect(h.stageInstructions(a).get("making")).toBe("Remake: Wrong size, remake");

    // finished again, it goes in the cart and is sent in a new shipment; the old shipment stays in the record
    finish(a);
    expect(sh.cartCandidates(master).map((x) => x.itemId)).toEqual([a]);
    expect(send(master, [a])).toEqual({ ok: true, orderCompleted: true });
    expect(o.getOrder(orderId)!.status).toBe("completed");
    expect(sh.submittedShipmentsForAdmin().filter((x) => x.items.some((i) => i.itemId === a))).toHaveLength(2);
  });

  it("can restart all the items, and refuses without a reason, without items, or on a cancelled order", () => {
    const { master, orderId, a, b } = setup();
    finish(a);
    finish(b);
    send(master, [a, b]);
    expect(r.remakeItems(orderId, [a, b], "  ")).toEqual({ ok: false, reason: "no-reason" });
    expect(r.remakeItems(orderId, [], "Wrong")).toEqual({ ok: false, reason: "no-items" });
    expect(r.remakeItems(orderId, [a, b], "Both wrong")).toEqual({ ok: true, count: 2 });
    expect([a, b].map((id) => s.itemStageViews(id)[0].status)).toEqual(["open", "open"]);

    const other = setup();
    o.setStatus(other.orderId, "cancelled");
    expect(r.remakeItems(other.orderId, [other.a], "Wrong")).toEqual({ ok: false, reason: "cancelled" });
  });
});
