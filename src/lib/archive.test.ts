import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

process.env.DATABASE_URL = ":memory:";

let t: typeof import("./templates");
let o: typeof import("./orders");
let m: typeof import("./masters");
let sh: typeof import("./shipping");
let dbm: typeof import("@/db");
let schema: typeof import("@/db/schema");

beforeAll(async () => {
  dbm = await import("@/db");
  migrate(dbm.db, { migrationsFolder: "./drizzle" });
  schema = await import("@/db/schema");
  t = await import("./templates");
  o = await import("./orders");
  m = await import("./masters");
  sh = await import("./shipping");
});

const base = (masterId: number, name: string) => ({
  customerName: name, myDueDate: "2099-01-01", karigarDueDate: "2099-01-01", masterId, details: "",
});
function newOrder(master: number, name: string, items = 1) {
  const main = t.createMainCategory("A" + Math.random(), "#000000");
  t.createSubCategory(main, "Pagri", "#111111");
  const tplId = t.listCategoryTree().find((c) => c.id === main)!.subs[0].template.id;
  const snapshot = t.templateForItem(tplId)!.snapshot;
  return o.createOrder(base(master, name), Array.from({ length: items }, (_, i) => ({ templateId: tplId, label: `Pagri ${i + 1}`, snapshot, values: {} })));
}
const names = (view: "finished" | "archived") => o.listAdminOrders({ view }).map((r) => r.customerName);

describe("the archive is its own section", () => {
  it("moves an order out of Finished into Archived, and back", () => {
    const master = m.createMaster({ name: "M", pin: "1" });
    const done = newOrder(master, "Done One", 0);
    const cancelled = newOrder(master, "Cancelled One");
    expect(o.masterComplete(master, done)).toEqual({ ok: true });
    expect(o.setStatus(cancelled, "cancelled")).toBe(true);

    expect(names("finished")).toEqual(expect.arrayContaining(["Done One", "Cancelled One"]));
    expect(names("archived")).not.toEqual(expect.arrayContaining(["Done One"]));
    const before = o.closedCounts();

    // archive both: they leave Finished and appear in Archived, remembering what they were
    expect(o.setStatus(done, "archived")).toBe(true);
    expect(o.setStatus(cancelled, "archived")).toBe(true);
    expect(names("finished")).not.toEqual(expect.arrayContaining(["Done One"]));
    expect(names("finished")).not.toEqual(expect.arrayContaining(["Cancelled One"]));
    expect(names("archived")).toEqual(expect.arrayContaining(["Done One", "Cancelled One"]));
    expect(o.closedCounts()).toEqual({ finished: before.finished - 2, archived: before.archived + 2 });
    expect(o.getOrder(done)!.archivedFrom).toBe("completed");
    expect(o.getOrder(cancelled)!.archivedFrom).toBe("cancelled");

    // unarchive: each comes back as what it was
    expect(o.unarchiveOrder(done)).toBe("completed");
    expect(o.unarchiveOrder(cancelled)).toBe("cancelled");
    expect(o.getOrder(done)).toMatchObject({ status: "completed", archivedFrom: null });
    expect(o.getOrder(cancelled)).toMatchObject({ status: "cancelled", archivedFrom: null });
    expect(names("finished")).toEqual(expect.arrayContaining(["Done One", "Cancelled One"]));
    expect(o.closedCounts()).toEqual(before);
  });

  it("only archives what is finished, and only unarchives what is archived", () => {
    const master = m.createMaster({ name: "M", pin: "1" });
    const live = newOrder(master, "Still Live");
    expect(o.setStatus(live, "archived")).toBe(false); // an active order cannot be put away
    expect(o.unarchiveOrder(live)).toBeNull(); // nothing to bring back
    expect(o.unarchiveOrder(999999)).toBeNull();
    expect(names("archived")).not.toContain("Still Live");
  });

  it("hides an archived order from its master, and shows it again when it comes back", () => {
    const master = m.createMaster({ name: "M", pin: "1" });
    const id = newOrder(master, "Hidden And Back", 0);
    o.masterComplete(master, id);
    expect(o.masterOrder(master, id)).not.toBeNull();
    o.setStatus(id, "archived");
    expect(o.masterOrder(master, id)).toBeNull(); // archived: gone from the master's side
    o.unarchiveOrder(id);
    expect(o.masterOrder(master, id)).toMatchObject({ status: "completed" }); // back, within the 15 days
  });

  it("works out what an order was when it was archived before that was written down", async () => {
    const { db } = dbm;
    const { orders } = schema;
    const { eq } = await import("drizzle-orm");
    const master = m.createMaster({ name: "M", pin: "1" });

    // never sent anything: it must have been cancelled
    const unsent = newOrder(master, "Old Unsent");
    o.setStatus(unsent, "cancelled");
    db.update(orders).set({ status: "archived", archivedFrom: null }).where(eq(orders.id, unsent)).run();
    expect(o.unarchiveOrder(unsent)).toBe("cancelled");

    // everything was sent: it was completed
    const sent = newOrder(master, "Old Sent");
    const item = o.listItems(sent)[0].id;
    const sid = sh.startShipment(master, sent)!;
    sh.saveShipmentItems(master, sid, [item], [item]);
    sh.attachShipmentPhoto({ id: sid, orderId: sent }, "bill", { fileKey: "k", thumbKey: "t", bytes: 1 });
    expect(sh.submitShipment(master, sid)).toEqual({ ok: true, orderCompleted: true });
    db.update(orders).set({ status: "archived", archivedFrom: null }).where(eq(orders.id, sent)).run();
    expect(o.unarchiveOrder(sent)).toBe("completed");

    // no items at all: nothing was left unsent, so completed
    const empty = newOrder(master, "Old Empty", 0);
    o.setStatus(empty, "cancelled");
    db.update(orders).set({ status: "archived", archivedFrom: null }).where(eq(orders.id, empty)).run();
    expect(o.unarchiveOrder(empty)).toBe("completed");
  });
});
