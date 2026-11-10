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

function kind() {
  const main = t.createMainCategory("AS" + Math.random(), "#000000");
  t.createSubCategory(main, "Coat", "#111111");
  const tplId = t.listCategoryTree().find((c) => c.id === main)!.subs[0].template.id;
  t.saveTemplate(tplId, t.rowsToFields([{ key: "", label: "Fabric", type: "text", required: "", unit: "" }]), t.rowsToStages([{ key: "", label: "Making", photo: "none" }]));
  return tplId;
}
const order = (master: number, tplId: number, name: string) =>
  o.createOrder(
    { customerName: name, myDueDate: "2099-01-01", karigarDueDate: "2099-01-01", masterId: master, details: "" },
    [{ templateId: tplId, label: "Coat", snapshot: t.templateForItem(tplId)!.snapshot, values: { fabric: "Silk" } }],
  );

describe("customers in progress follow their item automatically", () => {
  it("updates active customers when the item changes, keeps what is filled in, and leaves closed ones alone", () => {
    const tpl = kind();
    const master = m.createMaster({ name: "AS Master", pin: "1" });
    const live = order(master, tpl, "Live");
    const closed = order(master, tpl, "Closed");
    o.setStatus(closed, "cancelled");

    // the item gets a new field and a new step
    t.saveTemplate(
      tpl,
      t.rowsToFields([
        { key: "fabric", label: "Fabric", type: "text", required: "", unit: "" },
        { key: "", label: "Lining", type: "text", required: "", unit: "" },
      ]),
      t.rowsToStages([{ key: "making", label: "Making", photo: "none" }, { key: "", label: "Final check", photo: "none" }]),
    );
    const item = (id: number) => o.listItems(id)[0];
    expect(item(live).snapshot.fields).toHaveLength(1); // still the old copy until the sync

    expect(sync.syncActiveItems({ templateId: tpl })).toBe(1); // only the active customer
    expect(item(live).snapshot.fields.map((f) => f.label)).toEqual(["Fabric", "Lining"]);
    expect(item(live).values.fabric).toBe("Silk"); // what was filled in stays
    expect(s.itemStageViews(item(live).id).map((x) => x.label)).toEqual(["Making", "Final check"]);
    expect(item(closed).snapshot.fields).toHaveLength(1); // the cancelled customer is not touched

    expect(sync.syncActiveItems({ templateId: tpl })).toBe(0); // nothing left to do
    expect(sync.syncActiveItems()).toBe(0);
  });

  it("can catch up one customer", () => {
    const tpl = kind();
    const master = m.createMaster({ name: "AS Two", pin: "2" });
    const a = order(master, tpl, "A");
    const b = order(master, tpl, "B");
    t.saveTemplate(tpl, t.rowsToFields([{ key: "fabric", label: "Fabric", type: "text", required: "", unit: "" }, { key: "", label: "Buttons", type: "text", required: "", unit: "" }]), t.rowsToStages([{ key: "making", label: "Making", photo: "none" }]));
    expect(sync.syncActiveItems({ orderId: a })).toBe(1);
    expect(o.listItems(a)[0].snapshot.fields).toHaveLength(2);
    expect(o.listItems(b)[0].snapshot.fields).toHaveLength(1); // the other customer waits for its own turn
  });
});
