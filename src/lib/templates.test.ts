import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

process.env.DATABASE_URL = ":memory:";

let t: typeof import("./templates");
let o: typeof import("./orders");
let m: typeof import("./masters");
let it_: typeof import("./items");

beforeAll(async () => {
  const { db } = await import("@/db");
  migrate(db, { migrationsFolder: "./drizzle" });
  t = await import("./templates");
  o = await import("./orders");
  m = await import("./masters");
  it_ = await import("./items");
});

const row = (label: string, type = "number", required = "required", unit = "inch", key = "") => ({
  key, label, type, required, unit,
});

describe("templates", () => {
  it("builds a Sherwani template with 9 measurements and adds Indo-western without code", () => {
    const men = t.createMainCategory("Men", "#0000ff");
    const subId = t.createSubCategory(men, "Sherwani", "#ff0000");
    const tpl = t.listCategoryTree()[0].subs[0].template;
    const labels = ["Chest", "Waist", "Shoulder", "Sleeve length", "Length", "Neck", "Hip", "Bicep", "Wrist"];
    t.saveTemplateFields(tpl.id, t.rowsToFields([row("Fabric", "text", "required", ""), ...labels.map((l) => row(l))]));
    const saved = t.getTemplate(tpl.id)!;
    expect(saved.fields.filter((f) => f.type === "number")).toHaveLength(9);
    expect(saved.fields[0].key).toBe("fabric");
    expect(saved.version).toBe(2);
    expect(subId).toBeGreaterThan(0);

    t.createSubCategory(men, "Indo-western", "#00ff00");
    expect(t.listCategoryTree()[0].subs.map((s) => s.name).sort()).toEqual(["Indo-western", "Sherwani"]);
  });

  it("keeps keys stable on rename and makes unique keys", () => {
    const used = new Set<string>();
    expect(t.uniqueKey("Sleeve length", used)).toBe("sleeve_length");
    expect(t.uniqueKey("Sleeve length", used)).toBe("sleeve_length_2");
    const f = t.rowsToFields([row("New name", "text", "optional", "", "old_key"), row("")]);
    expect(f).toEqual([{ key: "old_key", label: "New name", type: "text", required: false }]);
  });

  it("warns about empty required fields, and editing the template does not change existing orders", () => {
    const master = m.createMaster({ name: "P2", pin: "1" });
    const men = t.createMainCategory("Test", "#111111");
    t.createSubCategory(men, "Kurta", "#222222");
    const tree = t.listCategoryTree().find((c) => c.name === "Test")!;
    const tplId = tree.subs[0].template.id;
    t.saveTemplateFields(tplId, t.rowsToFields([row("Sleeve length"), row("Colour", "text", "optional", "")]));

    const item = t.templateForItem(tplId)!;
    const missing = it_.missingRequired(item.snapshot.fields, {});
    expect(missing.map((f) => f.label)).toEqual(["Sleeve length"]);

    const orderId = o.createOrder(
      { customerName: "A", myDueDate: "2099-01-01", karigarDueDate: "2099-01-01", masterId: master, details: "" },
      [{ templateId: tplId, label: "Kurta", snapshot: item.snapshot, values: { colour: "red" } }],
    ); // "Submit anyway": saved although Sleeve length is empty

    // now change and then delete the template
    t.saveTemplateFields(tplId, t.rowsToFields([row("Totally different", "text", "optional", "")]));
    t.deleteCategory(tree.subs[0].id);

    const items = o.listItems(orderId);
    expect(items).toHaveLength(1);
    expect(items[0].snapshot.fields.map((f) => f.label)).toEqual(["Sleeve length", "Colour"]);
    expect(items[0].values).toEqual({ colour: "red" });
  });

  it("shows items to the master and flags Updated when item values change", async () => {
    const master = m.createMaster({ name: "P2b", pin: "1" });
    const main = t.createMainCategory("Test2", "#111111");
    t.createSubCategory(main, "Pants", "#333333");
    const tplId = t.listCategoryTree().find((c) => c.name === "Test2")!.subs[0].template.id;
    t.saveTemplateFields(tplId, t.rowsToFields([row("Waist")]));
    const item = t.templateForItem(tplId)!;
    const id = o.createOrder(
      { customerName: "B", myDueDate: "2099-01-01", karigarDueDate: "2099-01-01", masterId: master, details: "" },
      [{ templateId: tplId, label: "Pants", snapshot: item.snapshot, values: { waist: "32" } }],
    );
    o.markSeen(master, id);
    expect(o.masterItems(id)[0].values).toEqual({ waist: "32" });
    await new Promise((r) => setTimeout(r, 5));
    const itemId = o.listItems(id)[0].id;
    o.updateOrder(id, { customerName: "B", myDueDate: "2099-01-01", karigarDueDate: "2099-01-01", masterId: master, details: "" }, new Map([[itemId, { waist: "34" }]]));
    expect(o.masterDashboard(master).active[0].badge).toBe("Updated");
  });

  it("copies one item with its form and steps, and a whole group with its items", () => {
    const g = t.createMainCategory("CopyGroup", "#123456");
    const sub = t.createSubCategory(g, "Kurta", "#abcdef");
    const tplId = t.templateIdOf(sub)!;
    t.saveTemplate(tplId, t.rowsToFields([row("Sleeve", "text", "required", "")]), t.rowsToStages([{ key: "", label: "Cutting", photo: "none" }]));

    const copyId = t.copyItem(sub)!;
    const copy = t.getTemplate(t.templateIdOf(copyId)!)!;
    expect(copy.sub.name).toBe("Kurta copy");
    expect(copy.sub.parentId).toBe(g);
    expect(copy.fields.map((f) => f.label)).toEqual(["Sleeve"]);
    expect(copy.stages.map((s) => s.label)).toEqual(["Cutting"]);
    expect(t.getTemplate(tplId)!.fields).toHaveLength(1); // the original is untouched
    expect(t.copyItem(g)).toBeNull(); // a group is not an item

    const newGroup = t.copyGroup(g)!;
    const subs = t.listCategoryTree().find((x) => x.id === newGroup)!;
    expect(subs.name).toBe("CopyGroup copy");
    expect(subs.subs.map((x) => x.name).sort()).toEqual(["Kurta", "Kurta copy"]);
    expect(subs.subs.every((x) => x.template.fields.length === 1)).toBe(true);
  });
});
