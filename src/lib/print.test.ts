import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

process.env.DATABASE_URL = ":memory:";

let t: typeof import("./templates");
let o: typeof import("./orders");
let m: typeof import("./masters");
let p: typeof import("./print");
let pdf: typeof import("./pdf");

beforeAll(async () => {
  const { db } = await import("@/db");
  migrate(db, { migrationsFolder: "./drizzle" });
  t = await import("./templates");
  o = await import("./orders");
  m = await import("./masters");
  p = await import("./print");
  pdf = await import("./pdf");
});

const row = (label: string, type = "number", unit = "inch") => ({ key: "", label, type, required: "optional", unit });

function makeType(main: number, name: string, fields: ReturnType<typeof row>[], group?: string) {
  t.createSubCategory(main, name, "#222222");
  const tpl = t.listCategoryTree().find((c) => c.id === main)!.subs.find((s) => s.name === name)!.template;
  t.saveTemplateFields(tpl.id, t.rowsToFields(fields));
  if (group) t.setPrintGroup(tpl.id, group);
  return tpl.id;
}

describe("print pages", () => {
  it("prints one page per item type, shared groups together, never My due date; and the PDF has the same pages", async () => {
    const main = t.createMainCategory("PrintTest", "#000000");
    const sherwani = makeType(main, "Sherwani", [row("Fabric", "text", ""), row("Chest"), row("Waist")]);
    const kurta = makeType(main, "Kurta", [row("Chest")]);
    const pagri = makeType(main, "Pagri", [row("Colour", "text", "")], "Pagri and Shoes");
    const shoes = makeType(main, "Shoes", [row("Size")], "Pagri and Shoes");

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
    expect(data.sheets.map((s) => s.title)).toEqual(["Sherwani", "Kurta", "Pagri and Shoes"]); // 3 pages
    expect(data.sheets[0].items.map((i) => i.label)).toEqual(["Sherwani 1", "Sherwani 2"]);
    expect(data.sheets[2].items.map((i) => i.label)).toEqual(["Pagri", "Shoes"]);
    expect(data.sheets[0].items[0].measures).toEqual([{ label: "Chest", value: "42 inch" }, { label: "Waist", value: "38 inch" }]);

    // My due date must never appear in what gets printed
    expect(JSON.stringify(data)).not.toContain("2031-07-07");
    expect(JSON.stringify(data)).toContain("2030-01-02");

    const file = await pdf.renderOrderPdf(data);
    expect(file.subarray(0, 5).toString()).toBe("%PDF-");
    const pages = file.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pages).toHaveLength(3);
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
});
