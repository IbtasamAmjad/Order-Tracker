import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

process.env.DATABASE_URL = ":memory:";

let t: typeof import("./templates");
let o: typeof import("./orders");
let m: typeof import("./masters");
let sync: typeof import("./item-sync");
let p: typeof import("./print");

beforeAll(async () => {
  const { db } = await import("@/db");
  migrate(db, { migrationsFolder: "./drizzle" });
  t = await import("./templates");
  o = await import("./orders");
  m = await import("./masters");
  sync = await import("./item-sync");
  p = await import("./print");
});

const fields = () =>
  t.rowsToFields([
    { key: "", label: "Fabric", type: "text", required: "", unit: "" },
    { key: "", label: "Measurements", type: "heading", required: "", unit: "" },
    { key: "", label: "Length", type: "number", required: "", unit: "inch", short: "L" },
    { key: "", label: "Chest", type: "number", required: "", unit: "inch", short: "Ch" },
    { key: "", label: "Sleeve", type: "text", required: "", unit: "" },
    { key: "", label: "Hip", type: "number", required: "", unit: "inch" },
  ]);

function kind() {
  const main = t.createMainCategory("SL" + Math.random(), "#000000");
  t.createSubCategory(main, "Coat", "#111111");
  const tplId = t.listCategoryTree().find((c) => c.id === main)!.subs[0].template.id;
  t.saveTemplate(tplId, fields(), []);
  return tplId;
}

describe("which slips are printed", () => {
  it("cleans what the builder sends: a known style, each saved box once, no empty rows", () => {
    const f = t.rowsToFields(
      [
        { key: "a", label: "Length", type: "number", required: "", unit: "" },
        { key: "b", label: "Chest", type: "text", required: "", unit: "" },
        { key: "c", label: "Notes", type: "longtext", required: "", unit: "" },
      ],
    );
    expect(t.cleanPrintLayout({ slip: "nonsense" }, f)).toEqual({ slip: "tailor" });
    expect(t.cleanPrintLayout({ slip: "both", karigarRows: [["a", "a", "c", "gone"], [], ["b"]] }, f)).toEqual({ slip: "both", karigarRows: [["a"], ["b"]] }); // long writing and unknown boxes are dropped
    expect(t.cleanPrintLayout(null, f)).toEqual({ slip: "tailor" });
  });

  it("is saved with the item, travels into new customers, and customers in progress follow it quietly", () => {
    const tpl = kind();
    const [length, chest, sleeve] = t.getTemplate(tpl)!.fields.filter((f) => f.type === "number" || f.label === "Sleeve").map((f) => f.key);
    expect(t.templateForItem(tpl)!.snapshot.print).toBeUndefined(); // nothing chosen = the tailor slip only

    const master = m.createMaster({ name: "SlipsMaster", pin: "1" });
    const make = (name: string) =>
      o.createOrder({ customerName: name, myDueDate: "2099-01-01", karigarDueDate: "2099-01-01", masterId: master, details: "" }, [
        { templateId: tpl, label: "Coat", snapshot: t.templateForItem(tpl)!.snapshot, values: { [length]: "40", [chest]: "42", [sleeve]: "24 ready" } },
      ]);
    const live = make("Live");
    const stay = t.getTemplate(tpl)!;
    t.saveTemplate(tpl, stay.fields, stay.stages, stay.workflowId, { slip: "both", karigarRows: [[chest, length], [sleeve]] });
    expect(t.templateForItem(tpl)!.snapshot.print).toEqual({ slip: "both", karigarRows: [[chest, length], [sleeve]] });
    expect(t.getTemplate(tpl)!.version).toBe(stay.version); // a print change is not a form change

    // the customer in progress gets it without being marked updated for the master
    const before = o.getOrder(live)!.changedForMasterAt;
    expect(sync.syncActiveItems({ templateId: tpl })).toBe(0);
    expect(o.listItems(live)[0].snapshot.print?.slip).toBe("both");
    expect(o.getOrder(live)!.changedForMasterAt).toEqual(before);

    // both slips are printed: the tailor slip and the karigar paper in the rows the office laid out, short names, filled in
    const sheet = p.buildPrintData(live)!.sheets[0].items[0];
    expect(sheet.slip).toBeDefined();
    expect(sheet.karigar!.title).toContain("Live");
    expect(sheet.karigar!.rows).toEqual([
      [{ label: "Ch", value: "42 inch" }, { label: "L", value: "40 inch" }],
      [{ label: "Sleeve", value: "24 ready" }],
    ]);
    expect(sheet.karigar!.cols).toBe(4);

    // only the karigar paper: no tailor slip; none: neither; with no rows chosen the measurements follow the form order
    t.saveTemplate(tpl, stay.fields, stay.stages, stay.workflowId, { slip: "karigar" });
    sync.syncActiveItems({ templateId: tpl });
    const only = p.buildPrintData(live)!.sheets[0].items[0];
    expect(only.slip).toBeUndefined();
    expect(only.karigar!.rows[0].map((c) => c.label)).toEqual(["L", "Ch", "Sleeve", "Hip"].filter((l) => l !== "Hip")); // Hip has no answer: left out
    t.saveTemplate(tpl, stay.fields, stay.stages, stay.workflowId, { slip: "none" });
    sync.syncActiveItems({ templateId: tpl });
    const none = p.buildPrintData(live)!.sheets[0].items[0];
    expect(none.slip).toBeUndefined();
    expect(none.karigar).toBeUndefined();

    // back to the default: stored as nothing, the tailor slip returns
    t.saveTemplate(tpl, stay.fields, stay.stages, stay.workflowId, { slip: "tailor" });
    expect(t.getTemplate(tpl)!.printLayout).toBeNull();
    sync.syncActiveItems({ templateId: tpl });
    expect(p.buildPrintData(live)!.sheets[0].items[0].slip).toBeDefined();
  });
});
