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

describe("what goes on the tailor slip", () => {
  it("stores the field switch only where it differs from the default (on under Measurements)", () => {
    const f = t.rowsToFields([
      { key: "", label: "Fabric", type: "text", required: "", unit: "", slip: true }, // above Measurements, switched on: kept
      { key: "", label: "Picture", type: "picture", required: "", unit: "", slip: true }, // a picture can never be on it
      { key: "", label: "Measurements", type: "heading", required: "", unit: "" },
      { key: "", label: "Style", type: "select", required: "", unit: "", options: "A\nB", slip: false }, // under it, switched off: kept
      { key: "", label: "Length", type: "number", required: "", unit: "inch", slip: true }, // same as the default: not stored
      { key: "", label: "Due", type: "deliverydate", required: "", unit: "", slip: true }, // a date never goes on it
    ]);
    expect(f.map((x) => x.slip)).toEqual([true, undefined, undefined, false, undefined, undefined]);
  });

  it("prints the switched fields and, when chosen, the design number, colour and 1 of 2 in the header", async () => {
    const main = t.createMainCategory("SW" + Math.random(), "#000000");
    t.createSubCategory(main, "Kurta", "#111111");
    const tpl = t.listCategoryTree().find((c) => c.id === main)!.subs[0].template.id;
    const f = t.rowsToFields([
      { key: "", label: "Fabric Color", type: "text", required: "", unit: "", slip: true },
      { key: "", label: "Embroidery color", type: "text", required: "", unit: "" },
      { key: "", label: "Measurements", type: "heading", required: "", unit: "" },
      { key: "", label: "Style", type: "text", required: "", unit: "", slip: false },
      { key: "", label: "Chest", type: "number", required: "", unit: "inch", short: "Ch" },
    ]);
    t.saveTemplate(tpl, f, [], null, { slip: "tailor", slipShow: { design: true, colour: true, count: true, junk: true } });
    expect(t.getTemplate(tpl)!.printLayout).toEqual({ slip: "tailor", slipShow: { design: true, colour: true, count: true } });

    const key = (l: string) => t.getTemplate(tpl)!.fields.find((x) => x.label === l)!.key;
    const values = { [key("Fabric Color")]: "Offwhite", [key("Embroidery color")]: "Gold", [key("Style")]: "Mid-open", [key("Chest")]: "42" };
    const master = m.createMaster({ name: "SlipSwitch", pin: "1" });
    const snap = t.templateForItem(tpl)!.snapshot;
    const order = o.createOrder(
      { customerName: "Two Kurtas", designNumber: "D77", myDueDate: "2099-02-02", karigarDueDate: "2099-01-01", masterId: master, details: "" },
      [
        { templateId: tpl, label: "Kurta", snapshot: snap, values },
        { templateId: tpl, label: "Kurta", snapshot: snap, values },
      ],
    );
    const items = p.buildPrintData(order)!.sheets[0].items;
    const slip = items[0].slip!;
    expect(slip.cells.map((c) => c.label)).toEqual(["Fabric Color", "Ch"]); // Fabric switched on, Style switched off
    expect(slip.head).toEqual({ design: "D77", colour: "Offwhite", count: "1 of 2" }); // the fabric colour, not the embroidery one
    expect(items[1].slip!.head!.count).toBe("2 of 2");
    expect(p.slipItemTitle("Kurta", slip.head)).toBe("Kurta Measurements (1 of 2)");
    expect(p.slipExtras(slip.head)).toEqual(["Design D77", "Colour Offwhite"]);
    expect(JSON.stringify(slip)).not.toContain("2099"); // never a date

    // the PDF: one page for the Kurta type (both Kurtas), then ONE page at the end with both tailor slips
    const { renderOrderPdf } = await import("./pdf");
    const file = await renderOrderPdf(p.buildPrintData(order)!);
    expect(file.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).toHaveLength(2);
    // "Download tailor slips": only the slips page
    expect(p.hasSlips(p.buildPrintData(order)!)).toBe(true);
    const only = await renderOrderPdf(p.buildPrintData(order)!, { only: "slips" });
    expect(only.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).toHaveLength(1);

    // switched off again: the header shows nothing extra
    t.saveTemplate(tpl, t.getTemplate(tpl)!.fields, [], null, { slip: "tailor" });
    sync.syncActiveItems({ templateId: tpl });
    expect(p.buildPrintData(order)!.sheets[0].items[0].slip!.head).toBeUndefined();
  });
  it('a switch-only change reaches customers in progress quietly: no new version, no Updated mark', () => {
    const tpl = kind();
    const master = m.createMaster({ name: 'SlipQuiet', pin: '1' });
    const live = o.createOrder({ customerName: 'Quiet', myDueDate: '2099-01-01', karigarDueDate: '2099-01-01', masterId: master, details: '' }, [
      { templateId: tpl, label: 'Coat', snapshot: t.templateForItem(tpl)!.snapshot, values: {} },
    ]);
    const before = t.getTemplate(tpl)!;
    const mark = o.getOrder(live)!.changedForMasterAt;
    const switched = before.fields.map((x) => (x.label === 'Fabric' ? { ...x, slip: true } : x));
    t.saveTemplate(tpl, switched, before.stages, before.workflowId);
    expect(t.getTemplate(tpl)!.version).toBe(before.version);
    expect(sync.syncActiveItems({ templateId: tpl })).toBe(0);
    expect(o.getOrder(live)!.changedForMasterAt).toEqual(mark);
    expect(o.listItems(live)[0].snapshot.fields.find((x) => x.label === 'Fabric')!.slip).toBe(true);
  });
});
