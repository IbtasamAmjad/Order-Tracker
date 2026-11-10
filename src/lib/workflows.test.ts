import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

process.env.DATABASE_URL = ":memory:";

let t: typeof import("./templates");
let w: typeof import("./workflows");
let o: typeof import("./orders");
let m: typeof import("./masters");

beforeAll(async () => {
  const { db } = await import("@/db");
  migrate(db, { migrationsFolder: "./drizzle" });
  t = await import("./templates");
  w = await import("./workflows");
  o = await import("./orders");
  m = await import("./masters");
});

let seq = 0;
/** An item type with a name field, so a step can require it. */
function kind(name: string) {
  const main = t.createMainCategory("W" + ++seq, "#000000");
  t.createSubCategory(main, name, "#111111");
  const tplId = t.listCategoryTree().find((c) => c.id === main)!.subs[0].template.id;
  t.saveTemplate(tplId, t.rowsToFields([{ key: "", label: "Size", type: "text", required: "", unit: "" }]), []);
  return tplId;
}
const steps = (...labels: string[]) => labels.map((label) => ({ key: "", label, photo: "optional" }));
const labels = (tplId: number) => t.getTemplate(tplId)!.stages.map((s) => s.label);

describe("workflows", () => {
  it("is a named list of steps that several item types can use, and that is not hardcoded", () => {
    const wf = w.createWorkflow("Garment", steps("Embroidery", "Stitching", "Final check"));
    const sherwani = kind("Sherwani");
    const kurta = kind("Kurta");
    w.assignWorkflow(sherwani, wf);
    w.assignWorkflow(kurta, wf);
    expect(labels(sherwani)).toEqual(["Embroidery", "Stitching", "Final check"]);
    expect(labels(kurta)).toEqual(["Embroidery", "Stitching", "Final check"]);
    expect(w.getWorkflow(wf)!.usedBy.map((u) => u.name).sort()).toEqual(["Kurta", "Sherwani"]);
    expect(t.getTemplate(kurta)!.workflowId).toBe(wf);
  });

  it("changing a workflow changes every item type that uses it, keeps their own 'must be filled in' ticks, and leaves old customers alone", () => {
    const wf = w.createWorkflow("Bridal flow", steps("Cutting", "Embroidery", "Final check"));
    const bridal = kind("Bridal");
    const ladies = kind("Ladies");
    w.assignWorkflow(bridal, wf);
    w.assignWorkflow(ladies, wf);

    // the Bridal item type makes its Embroidery step wait for the Size field
    const tpl = t.getTemplate(bridal)!;
    const sizeKey = tpl.fields[0].key;
    t.saveTemplate(bridal, tpl.fields, tpl.stages.map((s) => (s.label === "Embroidery" ? { ...s, requiresFields: [sizeKey] } : s)));
    expect(t.getTemplate(bridal)!.stages.find((s) => s.label === "Embroidery")!.requiresFields).toEqual([sizeKey]);
    expect(t.getTemplate(ladies)!.stages.find((s) => s.label === "Embroidery")!.requiresFields).toBeUndefined();

    // a customer made before the change
    const master = m.createMaster({ name: "WF", pin: "1" });
    const before = o.createOrder({ customerName: "Old", myDueDate: "2099-01-01", karigarDueDate: "2099-01-01", masterId: master, details: "" }, [
      { templateId: bridal, label: "Bridal", snapshot: t.templateForItem(bridal)!.snapshot, values: {} },
    ]);

    const versionBefore = t.getTemplate(bridal)!.version;
    w.updateWorkflow(wf, "Bridal flow", [{ key: "cutting", label: "Cutting", photo: "none" }, { key: "embroidery", label: "Embroidery", photo: "required" }, { key: "trial", label: "Trial", photo: "optional" }, { key: "final_check", label: "Final check", photo: "optional" }]);

    for (const id of [bridal, ladies]) expect(labels(id)).toEqual(["Cutting", "Embroidery", "Trial", "Final check"]);
    expect(t.getTemplate(bridal)!.stages.find((s) => s.label === "Embroidery")).toMatchObject({ photo: "required", requiresFields: [sizeKey] }); // the tick stayed
    expect(t.getTemplate(bridal)!.version).toBeGreaterThan(versionBefore);
    // the customer made before keeps the steps it was made with
    expect(o.listItems(before)[0].snapshot.stages!.map((s) => s.label)).toEqual(["Cutting", "Embroidery", "Final check"]);

    // saving the item's form again cannot change the steps the workflow gives it
    const now = t.getTemplate(bridal)!;
    t.saveTemplate(bridal, now.fields, [{ key: "x", label: "Something else", photo: "none" }], now.workflowId);
    expect(labels(bridal)).toEqual(["Cutting", "Embroidery", "Trial", "Final check"]);
  });

  it("goes back to custom steps, and deleting a workflow leaves the item types with their steps", () => {
    const wf = w.createWorkflow("Shoes flow", steps("Embroidery", "Production", "Delivery"));
    const shoes = kind("Shoes");
    w.assignWorkflow(shoes, wf);
    expect(labels(shoes)).toEqual(["Embroidery", "Production", "Delivery"]);

    // custom: saving with no workflow lets the item change its steps
    const tpl = t.getTemplate(shoes)!;
    t.saveTemplate(shoes, tpl.fields, t.rowsToStages(steps("Making")), null);
    expect(labels(shoes)).toEqual(["Making"]);
    expect(t.getTemplate(shoes)!.workflowId).toBeNull();

    w.assignWorkflow(shoes, wf);
    w.deleteWorkflow(wf);
    expect(w.getWorkflow(wf)).toBeNull();
    expect(labels(shoes)).toEqual(["Embroidery", "Production", "Delivery"]); // kept
    expect(t.getTemplate(shoes)!.workflowId).toBeNull(); // but now its own
  });

  it("makes a reusable workflow from an item's steps, and keeps names unique", () => {
    const k = kind("Accessories");
    const tpl = t.getTemplate(k)!;
    t.saveTemplate(k, tpl.fields, t.rowsToStages(steps("Making", "Final check")), null);
    const id = w.workflowFromTemplate(k, "Simple item");
    expect(w.getWorkflow(id)!.stages.map((s) => s.label)).toEqual(["Making", "Final check"]);
    expect(t.getTemplate(k)!.workflowId).toBe(id);

    expect(() => w.createWorkflow("simple ITEM", steps("A"))).toThrow(/already a workflow/);
    expect(() => w.createWorkflow("  ", steps("A"))).toThrow(/Give the steps a name/);
    expect(w.checkWorkflowName("Simple item", id)).toBeNull(); // its own name is fine when editing it
  });
});
