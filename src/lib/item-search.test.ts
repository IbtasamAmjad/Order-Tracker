import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

process.env.DATABASE_URL = ":memory:";

let t: typeof import("./templates");
let o: typeof import("./orders");
let m: typeof import("./masters");
let s: typeof import("./stages");
let sh: typeof import("./shipping");
let q: typeof import("./item-search");
let h: typeof import("./history");

beforeAll(async () => {
  const { db } = await import("@/db");
  migrate(db, { migrationsFolder: "./drizzle" });
  t = await import("./templates");
  o = await import("./orders");
  m = await import("./masters");
  s = await import("./stages");
  sh = await import("./shipping");
  q = await import("./item-search");
  h = await import("./history");
});

const file = { fileKey: "k", thumbKey: "t", bytes: 1 };
const base = (masterId: number, name: string, design?: string) => ({
  customerName: name, myDueDate: "2099-01-01", karigarDueDate: "2099-01-01", masterId, details: "", designNumber: design,
});
let seq = 0;
/** An item kind with a colour field, an embroidery field and two steps. */
function kind(name: string) {
  const main = t.createMainCategory("G" + ++seq, "#000000");
  t.createSubCategory(main, name, "#111111");
  const tplId = t.listCategoryTree().find((c) => c.id === main)!.subs[0].template.id;
  t.saveTemplate(
    tplId,
    t.rowsToFields([
      { key: "", label: "Fabric and colour", type: "text", required: "", unit: "" },
      { key: "", label: "Embroidery details", type: "longtext", required: "", unit: "" },
    ]),
    t.rowsToStages([{ key: "", label: "Making", photo: "optional" }, { key: "", label: "Final check", photo: "optional" }]),
  );
  return { tplId, snapshot: t.templateForItem(tplId)!.snapshot };
}
const item = (k: ReturnType<typeof kind>, colour: string, embroidery = "") => ({
  templateId: k.tplId,
  label: "x",
  snapshot: k.snapshot,
  values: { fabric_and_colour: colour, embroidery_details: embroidery },
});

describe("searching ordered items", () => {
  it("lists every item with its customer, design number, colour, embroidery and status, and counts each kind", () => {
    const shoes = kind("Shoes");
    const shawls = kind("Shawls");
    const a = m.createMaster({ name: "IS A", pin: "1" });
    const b = m.createMaster({ name: "IS B", pin: "2" });
    const o1 = o.createOrder(base(a, "Zara Khan", "ZK-1"), [item(shoes, "Black leather"), item(shawls, "Cream pashmina", "Gold border")]);
    const o2 = o.createOrder(base(b, "Bilal Raza", "BR-7"), [item(shoes, "Tan suede")]);

    const all = q.itemRows();
    const mine = all.filter((r) => [o1, o2].includes(r.orderId));
    expect(mine).toHaveLength(3);
    const shawl = mine.find((r) => r.itemName === "Shawls")!;
    expect(shawl).toMatchObject({ customerName: "Zara Khan", designNumber: "ZK-1", colourText: "Cream pashmina", embroidery: "Gold border", status: "not-started" });

    // total quantity of each kind
    const qty = q.quantityByItem(mine);
    expect(qty.map((x) => [x.itemName, x.total])).toEqual([["Shoes", 2], ["Shawls", 1]]);

    // the dropdown (one kind), and words in any order
    expect(q.searchItems(mine, { type: "Shawls" }).map((r) => r.itemName)).toEqual(["Shawls"]);
    expect(q.searchItems(mine, { q: "suede tan" }).map((r) => r.customerName)).toEqual(["Bilal Raza"]);
    expect(q.searchItems(mine, { q: "br-7" }).map((r) => r.itemName)).toEqual(["Shoes"]); // by design number
    expect(q.searchItems(mine, { q: "gold" })).toHaveLength(1); // by embroidery details
    expect(q.searchItems(mine, { q: "nothing like this" })).toHaveLength(0);

    // a master sees only the items of his own orders
    expect(q.itemRows(b).filter((r) => [o1, o2].includes(r.orderId)).map((r) => r.customerName)).toEqual(["Bilal Raza"]);
  });

  it("follows production: shoes that are not made yet, then ready, then shipped", () => {
    const shoes = kind("Shoes");
    const a = m.createMaster({ name: "IS C", pin: "1" });
    const o1 = o.createOrder(base(a, "First", "F-1"), [item(shoes, "Red")]);
    const o2 = o.createOrder(base(a, "Second", "F-2"), [item(shoes, "Blue")]);
    const [i1, i2] = [o.listItems(o1)[0].id, o.listItems(o2)[0].id];
    const where = (status: string) => q.searchItems(q.itemRows().filter((r) => [o1, o2].includes(r.orderId)), { type: shoes.snapshot.templateName, status }).map((r) => r.customerName);

    expect(where("not-made")).toEqual(["First", "Second"]);
    s.completeStage({ by: "admin" }, i1, "making"); // one step done: in production
    expect(where("in-production")).toEqual(["First"]);
    expect(where("not-started")).toEqual(["Second"]);
    expect(where("not-made")).toEqual(["First", "Second"]);

    s.completeStage({ by: "admin" }, i1, "final_check"); // all steps done: ready
    expect(where("ready")).toEqual(["First"]);
    expect(where("not-made")).toEqual(["Second"]);

    // sent in a shipment: shipped
    const sid = sh.startShipment(a, o1)!;
    sh.saveShipmentItems(a, sid, [i1], [i1]);
    sh.attachShipmentPhoto({ id: sid, orderId: o1 }, "bill", file);
    expect(sh.submitShipment(a, sid)).toEqual({ ok: true, orderCompleted: true });
    expect(where("shipped")).toEqual(["First"]);
    expect(where("ready")).toEqual([]);
    expect(i2).toBeGreaterThan(0);
  });
  it("filters by due date and by design number, and builds the master's pending work", () => {
    const k = kind("Scarves");
    const a = m.createMaster({ name: "IS Due", pin: "3" });
    const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const mk = (name: string, design: string, n: number) =>
      o.createOrder({ ...base(a, name, design), karigarDueDate: day(n) }, [item(k, "Red")]);
    const late = mk("Late One", "DUE-1", -2);
    const soon = mk("Soon One", "DUE-2", 5);
    const far = mk("Far One", "DUE-3", 30);
    for (const id of [late, soon, far]) h.confirmOrder(a, id);
    const rows = q.itemRows(a);
    const names = (due: string) => q.searchItems(rows, { due }).map((r) => r.customerName).sort();
    expect(names("late")).toEqual(["Late One"]);
    expect(names("7")).toEqual(["Late One", "Soon One"]);
    expect(names("14")).toEqual(["Late One", "Soon One"]);
    expect(q.searchItems(rows, { design: "due-3" }).map((r) => r.customerName)).toEqual(["Far One"]);
    expect(q.pendingWork(a).map((p) => p.customerName)).toEqual(["Late One", "Soon One", "Far One"]); // nearest due date first
    expect(q.pendingWork(a)[0]).toMatchObject({ stepLabel: "Making", designNumber: "DUE-1" });
  });
});
