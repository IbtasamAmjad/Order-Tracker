import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

process.env.DATABASE_URL = ":memory:";

let t: typeof import("./templates");
let o: typeof import("./orders");
let m: typeof import("./masters");
let p: typeof import("./print");
let pdf: typeof import("./pdf");
let st: typeof import("./stages");

beforeAll(async () => {
  const { db } = await import("@/db");
  migrate(db, { migrationsFolder: "./drizzle" });
  t = await import("./templates");
  o = await import("./orders");
  m = await import("./masters");
  p = await import("./print");
  pdf = await import("./pdf");
  st = await import("./stages");
});

const row = (label: string, type = "number", unit = "inch") => ({ key: "", label, type, required: "optional", unit });

function makeType(main: number, name: string, fields: ReturnType<typeof row>[]) {
  t.createSubCategory(main, name, "#222222");
  const tpl = t.listCategoryTree().find((c) => c.id === main)!.subs.find((s) => s.name === name)!.template;
  t.saveTemplateFields(tpl.id, t.rowsToFields(fields));
  return tpl.id;
}

describe("print pages", () => {
  it("prints one page per item type, never My due date; and the PDF has the same pages", async () => {
    const main = t.createMainCategory("PrintTest", "#000000");
    const sherwani = makeType(main, "Sherwani", [row("Fabric", "text", ""), row("Chest"), row("Waist")]);
    const kurta = makeType(main, "Kurta", [row("Chest")]);
    const pagri = makeType(main, "Pagri", [row("Colour", "text", "")]);
    const shoes = makeType(main, "Shoes", [row("Size")]);

    const master = m.createMaster({ name: "Pr", pin: "1" });
    const mk = (id: number, label: string, values: Record<string, string>) => ({
      templateId: id, label, snapshot: t.templateForItem(id)!.snapshot, values,
    });
    const orderId = o.createOrder(
      { customerName: "Usha", myDueDate: "2031-07-07", karigarDueDate: "2030-01-02", masterId: master, details: "Handle with care" },
      [
        mk(sherwani, "Sherwani 1", { fabric: "Silk", chest: "42", waist: "38" }),
        mk(sherwani, "Sherwani 2", { fabric: "Wool", chest: "44" }),
        mk(kurta, "Kurta", { chest: "40" }),
        mk(pagri, "Pagri", { colour: "Red" }),
        mk(shoes, "Shoes", { size: "10" }),
      ],
    );

    const data = p.buildPrintData(orderId)!;
    expect(data.sheets.map((s) => s.title)).toEqual(["Sherwani", "Kurta", "Pagri", "Shoes"]); // 4 pages
    expect(data.sheets[0].items.map((i) => i.label)).toEqual(["Sherwani 1", "Sherwani 2"]);
    expect(data.sheets[2].items.map((i) => i.label)).toEqual(["Pagri"]);
    expect(data.sheets[0].items[0].measures).toEqual([{ label: "Chest", value: "42 inch" }, { label: "Waist", value: "38 inch" }]);

    // My due date must never appear in what gets printed
    expect(JSON.stringify(data)).not.toContain("2031-07-07");
    expect(JSON.stringify(data)).toContain("2030-01-02");

    const file = await pdf.renderOrderPdf(data);
    expect(file.subarray(0, 5).toString()).toBe("%PDF-");
    const pages = file.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pages).toHaveLength(4);
  });

  it("sizes pictures smaller when a page has more of them", () => {
    const sheet = (n: number) => ({ key: "k", title: "T", items: [{ label: "x", colour: "", details: [], measures: [], photoIds: Array(n).fill(1) }] });
    expect(p.photoHeightMm(sheet(1))).toBeGreaterThan(p.photoHeightMm(sheet(4)));
    expect(p.photoHeightMm(sheet(4))).toBeGreaterThan(p.photoHeightMm(sheet(9)));
  });

  it("still makes a page for an order with no items", async () => {
    const master = m.createMaster({ name: "Pr2", pin: "1" });
    const id = o.createOrder({ customerName: "Plain", myDueDate: "2031-01-01", karigarDueDate: "2030-01-01", masterId: master, details: "Just notes" });
    const data = p.buildPrintData(id)!;
    expect(data.sheets).toEqual([]);
    const file = await pdf.renderOrderPdf(data);
    expect((file.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
  });
  it("prints a picture under its own field, groups measurements in a grid, and writes the due date in words", () => {
    const main = t.createMainCategory("PrintPics", "#000000");
    t.createSubCategory(main, "Coat", "#333333");
    const tpl = t.listCategoryTree().find((c) => c.id === main)!.subs.find((s) => s.name === "Coat")!.template;
    t.saveTemplateFields(
      tpl.id,
      t.rowsToFields([
        { key: "", label: "Fabric", type: "text", required: "optional", unit: "" },
        { key: "", label: "Embroidery details", type: "longtext", required: "optional", unit: "", pictures: true },
        { key: "", label: "Measurements", type: "heading", required: "optional", unit: "" },
        { key: "", label: "Length", type: "text", required: "optional", unit: "" },
        { key: "", label: "Chest", type: "text", required: "optional", unit: "" },
        { key: "", label: "Reference picture", type: "picture", required: "optional", unit: "" },
      ]),
    );
    const master = m.createMaster({ name: "PP", pin: "1" });
    const orderId = o.createOrder(
      { customerName: "Pic Customer", myDueDate: "2031-07-07", karigarDueDate: "2030-01-02", masterId: master, details: "" },
      [{ templateId: tpl.id, label: "Coat", snapshot: t.templateForItem(tpl.id)!.snapshot, values: { fabric: "Silk", embroidery_details: "Gold border", length: "42", chest: "38" } }],
    );
    const itemId = o.listItems(orderId)[0].id;
    const file = { fileKey: "k", thumbKey: "t", bytes: 1 };
    const under = st.addReferencePhoto({ orderId, itemId, fieldKey: "embroidery_details", ...file });
    const design = st.addReferencePhoto({ orderId, itemId, fieldKey: "reference_picture", ...file });

    const data = p.buildPrintData(orderId)!;
    expect(data.dueLabel).toBe("2 January 2030");
    const item = data.sheets[0].items[0];
    expect(item.details.find((d) => d.label === "Embroidery details")!.photoIds).toEqual([under]); // right under its field
    expect(item.photoIds).toEqual([design]); // the other picture stays at the end, the field one is not repeated
    expect(p.allPhotoIds(data).sort()).toEqual([under, design].sort());

    const blocks = p.layoutDetails(item.details, item.measures);
    expect(blocks.map((b) => b.type)).toEqual(["row", "row", "heading", "grid"]);
    expect(blocks[3]).toEqual({ type: "grid", cols: 4, cells: [{ label: "Length", value: "42" }, { label: "Chest", value: "38" }] });
  });
});
