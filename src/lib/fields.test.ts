import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { FieldDef } from "@/db/schema";

process.env.DATABASE_URL = ":memory:";

let t: typeof import("./templates");
let o: typeof import("./orders");
let m: typeof import("./masters");
let it_: typeof import("./items");
let p: typeof import("./print");
let pdf: typeof import("./pdf");

beforeAll(async () => {
  const { db } = await import("@/db");
  migrate(db, { migrationsFolder: "./drizzle" });
  t = await import("./templates");
  o = await import("./orders");
  m = await import("./masters");
  it_ = await import("./items");
  p = await import("./print");
  pdf = await import("./pdf");
});

const row = (label: string, type: string, extra: Partial<{ required: string; unit: string; options: string; who: string }> = {}) => ({
  key: "",
  label,
  type,
  required: "optional",
  unit: "",
  ...extra,
});

describe("field types", () => {
  it("builds every field type with options, required and who-can-fill", () => {
    const fields = t.rowsToFields([
      row("Fabric", "select", { options: "Silk\nCotton\n  Silk \n\nWool", required: "required" }),
      row("Style", "radio", { options: "Slim\nRegular" }),
      row("Extras", "checkboxes", { options: "Lining\nPockets\nBelt", who: "master" }),
      row("Notes", "longtext", { who: "master" }),
      row("Phone", "phone"),
      row("Pickup time", "time"),
      row("Chest", "number", { unit: "inch" }),
      row("Reference", "picture", { who: "master" }),
      row("Measure carefully", "heading", { required: "required", who: "master" }),
      row("Bogus", "nonsense"),
      row("Short note", "text", { unit: "ignored" }),
    ]);
    const by = Object.fromEntries(fields.map((f) => [f.label, f]));
    expect(by.Fabric).toMatchObject({ type: "select", required: true, options: ["Silk", "Cotton", "Wool"] }); // blanks/repeats removed
    expect(by.Extras).toMatchObject({ type: "checkboxes", masterCanEdit: true });
    expect(by.Notes.masterCanEdit).toBe(true);
    expect(by.Reference).toMatchObject({ type: "picture", masterCanEdit: true });
    expect(by.Chest.unit).toBe("inch");
    expect(by["Short note"].unit).toBeUndefined(); // units only for numbers
    expect(by["Measure carefully"]).toMatchObject({ type: "heading", required: false });
    expect(by["Measure carefully"].masterCanEdit).toBeUndefined();
    expect(by.Bogus.type).toBe("text"); // unknown type falls back to text
    expect(by.Fabric.masterCanEdit).toBeUndefined();
  });

  it("cleans answers: choices must be real options; checkboxes keep only valid picks", () => {
    const fields: FieldDef[] = [
      { key: "fabric", label: "Fabric", type: "select", required: true, options: ["Silk", "Cotton"] },
      { key: "extras", label: "Extras", type: "checkboxes", required: false, options: ["Lining", "Pockets"] },
      { key: "note", label: "Note", type: "longtext", required: false },
      { key: "pic", label: "Pic", type: "picture", required: true },
      { key: "h", label: "Heading", type: "heading", required: true },
    ];
    expect(it_.cleanValues(fields, { fabric: "Gold", extras: "Lining\nHacked\nPockets", note: "  hi  ", pic: "x", h: "y" })).toEqual({
      extras: "Lining\nPockets",
      note: "hi",
    });
    expect(it_.cleanValues(fields, { fabric: "Silk" })).toEqual({ fabric: "Silk" });
    expect(it_.missingRequired(fields, {}).map((f) => f.key)).toEqual(["fabric"]); // pictures and headings never warn
    expect(it_.displayValue(fields[1], "Lining\nPockets")).toBe("Lining, Pockets");
    expect(it_.displayValue(fields[4], "x")).toBe("");
  });
});

describe("master fills his fields", () => {
  function setup() {
    const main = t.createMainCategory("F" + Math.random(), "#000000");
    t.createSubCategory(main, "Kurta", "#111111");
    const tplId = t.listCategoryTree().find((c) => c.id === main)!.subs[0].template.id;
    t.saveTemplateFields(
      tplId,
      t.rowsToFields([
        row("Fabric", "text"),
        row("Master comment", "longtext", { who: "master" }),
        row("Extras", "checkboxes", { options: "Lining\nPockets", who: "master" }),
      ]),
    );
    const master = m.createMaster({ name: "FM" + Math.random(), pin: "1" });
    const other = m.createMaster({ name: "Other" + Math.random(), pin: "2" });
    const orderId = o.createOrder(
      { customerName: "C", myDueDate: "2099-01-01", karigarDueDate: "2099-01-01", masterId: master, details: "" },
      [{ templateId: tplId, label: "Kurta", snapshot: t.templateForItem(tplId)!.snapshot, values: { fabric: "Silk" } }],
    );
    return { master, other, orderId, itemId: o.listItems(orderId)[0].id };
  }

  it("changes only the fields Admin allowed, and tells Admin", () => {
    const { master, orderId, itemId } = setup();
    expect(o.getOrder(orderId)!.masterEditedAt).toBeNull();
    expect(o.masterSaveFields(master, orderId, itemId, { master_comment: "Collar done", extras: "Lining\nPockets", fabric: "HACKED" })).toBe(true);
    const item = o.listItems(orderId)[0];
    expect(item.values).toEqual({ fabric: "Silk", master_comment: "Collar done", extras: "Lining\nPockets" }); // fabric untouched
    expect(o.getOrder(orderId)!.masterEditedAt).not.toBeNull();

    // clearing a field removes it
    o.masterSaveFields(master, orderId, itemId, { master_comment: "", extras: "Lining" });
    expect(o.listItems(orderId)[0].values).toEqual({ fabric: "Silk", extras: "Lining" });
  });

  it("refuses other masters, closed orders and unknown items", () => {
    const { master, other, orderId, itemId } = setup();
    expect(o.masterSaveFields(other, orderId, itemId, { master_comment: "x" })).toBe(false);
    expect(o.masterSaveFields(master, orderId, itemId + 999, { master_comment: "x" })).toBe(false);
    expect(o.listItems(orderId)[0].values).toEqual({ fabric: "Silk" });
    o.setStatus(orderId, "cancelled");
    expect(o.masterSaveFields(master, orderId, itemId, { master_comment: "x" })).toBe(false);
  });

  it("admin saving the form keeps what the master wrote", () => {
    const { master, orderId, itemId } = setup();
    o.masterSaveFields(master, orderId, itemId, { master_comment: "From master" });
    const values = { ...o.listItems(orderId)[0].values, fabric: "Cotton" }; // the admin form posts every field
    o.updateOrder(orderId, { customerName: "C", myDueDate: "2099-01-01", karigarDueDate: "2099-01-01", masterId: master, details: "" }, new Map([[itemId, values]]));
    expect(o.listItems(orderId)[0].values).toEqual({ fabric: "Cotton", master_comment: "From master" });
  });
});

describe("one PDF page per category", () => {
  it("prints each category on its own page, with the master's comments and checkboxes", async () => {
    const main = t.createMainCategory("P" + Math.random(), "#000000");
    const mk = (name: string, fields: ReturnType<typeof row>[]) => {
      t.createSubCategory(main, name, "#222222");
      const tpl = t.listCategoryTree().find((c) => c.id === main)!.subs.find((s) => s.name === name)!.template;
      t.saveTemplateFields(tpl.id, t.rowsToFields(fields));
      return tpl.id;
    };
    const kurta = mk("Kurta", [row("Extras", "checkboxes", { options: "Lining\nPockets" }), row("Master comment", "longtext", { who: "master" }), row("Note", "heading")]);
    const pants = mk("Pants", [row("Waist", "number", { unit: "inch" })]);
    const shoes = mk("Shoes", [row("Size", "text")]);
    const master = m.createMaster({ name: "Pdf" + Math.random(), pin: "1" });
    const item = (id: number, label: string, values: Record<string, string>) => ({ templateId: id, label, snapshot: t.templateForItem(id)!.snapshot, values });
    const orderId = o.createOrder(
      { customerName: "Usha", myDueDate: "2031-07-07", karigarDueDate: "2030-01-02", masterId: master, details: "" },
      [item(kurta, "Kurta", { extras: "Lining\nPockets", master_comment: "Sleeve is ready" }), item(pants, "Pants", { waist: "32" }), item(shoes, "Shoes", { size: "10" })],
    );
    const data = p.buildPrintData(orderId)!;
    expect(data.sheets.map((s) => s.title)).toEqual(["Kurta", "Pants", "Shoes"]);
    expect(data.sheets[0].items[0].details).toEqual([
      { label: "Extras", value: "Lining, Pockets" },
      { label: "Master comment", value: "Sleeve is ready" },
      { label: "Note", value: "", kind: "heading" },
    ]); // headings are printed too, as bold titles, in form order
    const file = await pdf.renderOrderPdf(data);
    expect((file.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(3);
  });
});

describe("drag-and-drop builder save format", () => {
  it("turns the builder's JSON into fields and steps, keeping existing keys", () => {
    const json = JSON.stringify([
      { key: "design_number", label: "Design number", type: "text", required: true, masterCanEdit: false, unit: "", options: "" },
      { key: "", label: "Sleeve", type: "radio", required: false, masterCanEdit: true, unit: "", options: "Full\nHalf\nFull" },
      { key: "", label: "Look here", type: "heading", required: true, masterCanEdit: true, unit: "", options: "" },
      { key: "", label: "Be careful with the collar", type: "note", required: false, masterCanEdit: false, unit: "", options: "" },
      { key: "", label: "   ", type: "text", required: false, masterCanEdit: false, unit: "", options: "" },
      { key: "", label: "Picture", type: "picture", required: false, masterCanEdit: true, unit: "", options: "" },
    ]);
    const fields = t.fieldsFromBuilder(json);
    expect(fields.map((f) => f.label)).toEqual(["Design number", "Sleeve", "Look here", "Be careful with the collar", "Picture"]); // blank dropped, order kept
    expect(fields[0]).toMatchObject({ key: "design_number", required: true });
    expect(fields[1]).toMatchObject({ type: "radio", options: ["Full", "Half"], masterCanEdit: true });
    expect(fields[2]).toMatchObject({ type: "heading", required: false });
    expect(fields[2].masterCanEdit).toBeUndefined();
    expect(fields[3].type).toBe("note");
    expect(fields[4]).toMatchObject({ type: "picture", masterCanEdit: true });

    const steps = t.stagesFromBuilder(JSON.stringify([{ key: "", label: "Cutting", photo: "none" }, { key: "", label: "", photo: "required" }, { key: "x", label: "Embroidery", photo: "required" }]));
    expect(steps).toEqual([
      { key: "cutting", label: "Cutting", photo: "none" },
      { key: "x", label: "Embroidery", photo: "required" },
    ]);
  });

  it("survives garbage input", () => {
    expect(t.fieldsFromBuilder("not json")).toEqual([]);
    expect(t.fieldsFromBuilder('{"a":1}')).toEqual([]);
    expect(t.fieldsFromBuilder("[null, 5, {\"label\": 7}]")).toEqual([]);
    expect(t.stagesFromBuilder("")).toEqual([]);
    expect(t.fieldsFromBuilder(JSON.stringify(Array.from({ length: 500 }, (_, i) => ({ label: "F" + i, type: "text" })))).length).toBe(200); // capped
  });

  it("notes and headings print in order and need no answer", () => {
    const fields = t.rowsToFields([row("Intro", "heading"), row("Be careful", "note"), row("Fabric", "text")]);
    expect(it_.missingRequired(fields, {})).toEqual([]);
    expect(it_.isDisplayOnly(fields[0])).toBe(true);
    expect(it_.isDisplayOnly(fields[2])).toBe(false);
  });
});
