import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

process.env.DATABASE_URL = ":memory:";

let o: typeof import("./orders");
let m: typeof import("./masters");
let s: typeof import("./stages");
let t: typeof import("./templates");
let set: typeof import("./settings");
let w: typeof import("./whatsapp");
let it_: typeof import("./items");
let h: typeof import("./history");
let rem: typeof import("./reminders");

beforeAll(async () => {
  const { db } = await import("@/db");
  migrate(db, { migrationsFolder: "./drizzle" });
  o = await import("./orders");
  m = await import("./masters");
  s = await import("./stages");
  t = await import("./templates");
  set = await import("./settings");
  w = await import("./whatsapp");
  it_ = await import("./items");
  h = await import("./history");
  rem = await import("./reminders");
});

const input = (masterId: number, name: string, karigar = "2099-03-05") => ({ customerName: name, myDueDate: "2099-01-01", karigarDueDate: karigar, masterId, details: "" });

const item = (fields: import("@/db/schema").FieldDef[], stages: import("@/db/schema").StageDef[]) => ({
  templateId: 0,
  label: "Sherwani",
  snapshot: { templateName: "Sherwani", path: "Men > Sherwani", colour: "#000000", version: 1, fields, stages },
  values: {},
});

describe("expected days on a step", () => {
  it("keeps only a whole number of days from 1 to 365", () => {
    expect(t.cleanDays("5")).toBe(5);
    expect(t.cleanDays(7)).toBe(7);
    for (const bad of ["", "0", "-2", "1.5", "abc", 400, null, undefined]) expect(t.cleanDays(bad)).toBeUndefined();
    const stages = t.rowsToStages([
      { key: "", label: "Cutting", photo: "none", days: "3" },
      { key: "", label: "Stitching", photo: "none", days: "" },
    ]);
    expect(stages[0].days).toBe(3);
    expect(stages[1].days).toBeUndefined();
  });

  it("counts from when a step starts and flags it when it takes longer", () => {
    const a = m.createMaster({ name: "DaysMaster", pin: "1111A" });
    const id = o.createOrder(input(a, "Days"), [item([], [{ key: "cut", label: "Cutting", photo: "none", days: 2 }, { key: "emb", label: "Embroidery", photo: "none", days: 5 }])]);
    const it = o.listItems(id)[0];
    const first = s.itemStageViews(it.id)[0];
    expect(first.days).toBe(2);
    expect(first.startedAt).not.toBeNull();
    expect(first.lateDays).toBe(0);
    expect(s.lateSteps(id)).toEqual([]);

    // three days later the first step is one day over; the locked one has no clock yet
    const later = new Date(Date.now() + 3 * 86_400_000);
    const views = s.itemStageViews(it.id, later);
    expect(views[0].lateDays).toBe(1);
    expect(views[1].dueAt).toBeNull();
    expect(s.lateSteps(id, later)).toEqual([{ itemLabel: "Sherwani", step: "Cutting", lateDays: 1 }]);

    // it shows up in the reminders
    const r = rem.remindersList(later).find((x) => x.orderId === id);
    expect(r?.reasons.join(" ")).toContain("Cutting is 1 day late");

    // finishing it starts the next step's clock
    h.confirmOrder(a, id);
    expect(s.completeStage({ by: "master", masterId: a }, it.id, "cut")).toEqual({ ok: true });
    const after = s.itemStageViews(it.id);
    expect(after[1].startedAt).not.toBeNull();
    expect(after[1].dueAt!.getTime() - after[1].startedAt!.getTime()).toBe(5 * 86_400_000);
  });
});

describe("customer name and delivery date fields", () => {
  const fields = [
    { key: "who", label: "Customer", type: "customername", required: true },
    { key: "when", label: "Delivery date", type: "deliverydate", required: true },
    { key: "no", label: "Order number", type: "ordernumber", required: true },
    { key: "design", label: "Design number", type: "designnumber", required: true },
    { key: "fabric", label: "Fabric", type: "text", required: false },
  ] as import("@/db/schema").FieldDef[];

  it("start with the order's value, follow it until the office changes them, and are never asked for", () => {
    const a = m.createMaster({ name: "AutoMaster", pin: "2222A" });
    const id = o.createOrder({ ...input(a, "Hamza Qureshi", "2099-03-05"), designNumber: "NS-9" }, [item(fields, [])]);
    const it = o.listItems(id)[0];
    expect(it.values.who).toBe("Hamza Qureshi");
    expect(it.values.when).toBe("5 March 2099");
    expect(it.values.no).toBe(String(o.getOrder(id)!.orderNumber));
    expect(it.values.design).toBe("NS-9");

    // untouched: they follow the order
    o.updateOrder(id, input(a, "Hamza Q", "2099-04-10"));
    const changed = o.listItems(id)[0];
    expect(changed.values.who).toBe("Hamza Q");
    expect(changed.values.when).toBe("10 April 2099");

    // the office types something else: it stays, even when the order changes again
    o.updateOrder(id, input(a, "Hamza Q", "2099-04-10"), new Map([[changed.id, { ...changed.values, who: "Mr Hamza" }]]));
    expect(o.listItems(id)[0].values.who).toBe("Mr Hamza");
    o.updateOrder(id, input(a, "Hamza Quresh", "2099-05-01"));
    expect(o.listItems(id)[0].values.who).toBe("Mr Hamza");
    expect(o.listItems(id)[0].values.when).toBe("1 May 2099");

    // nothing to fill in: not missing, not counted, the master cannot edit them; typed values are kept
    expect(it_.missingFields(fields, {}).map((f) => f.key)).toEqual([]);
    expect(it_.fieldProgress(fields, {}).total).toBe(1);
    expect(it_.cleanValues(fields, { who: "Typed", when: "Later", fabric: "Silk" })).toEqual({ who: "Typed", when: "Later", fabric: "Silk" });
    expect(it_.isTextEditable({ ...fields[0], masterCanEdit: true })).toBe(false);
    expect(t.rowsToFields([{ key: "", label: "Customer", type: "customername", required: "required", unit: "", who: "master" }])[0]).toMatchObject({ type: "customername", required: false });
  });
});

describe("text with several lines", () => {
  it("keeps each line as its own line", () => {
    const f = [{ key: "emb", label: "Embroidery", type: "text", required: false }] as import("@/db/schema").FieldDef[];
    expect(it_.cleanValues(f, { emb: "Collar green\r\nNo back motif\r\nExtra finishing  " })).toEqual({ emb: "Collar green\nNo back motif\nExtra finishing" });
  });
});

describe("a question from the master", () => {
  it("names the order and links to it, and never holds My due date", () => {
    set.setSetting("office_whatsapp", "923001234567");
    expect(set.officeWhatsapp()).toBe("923001234567");
    set.setSetting("office_whatsapp", "");
    expect(set.officeWhatsapp()).toBe("");
    const text = w.messages.question({
      masterName: "Naseem",
      orderId: 42,
      orderNumber: 7,
      customer: "Hamza Qureshi",
      info: { design: "1992", dueDate: "2099-03-05", items: [{ label: "Sherwani", state: "making", stage: "Cutting" }], summary: "" },
    });
    expect(text).toContain("Question about order #7 - Hamza Qureshi (design 1992)");
    expect(text).toContain("Items: Sherwani");
    expect(text).toContain("Due date: 5 March 2099");
    expect(text).toContain("/admin/orders/42");
    expect(text.trim().endsWith("My question:")).toBe(true);
  });
});

describe("measurements table with words and numbers", () => {
  it("puts number boxes and word boxes in one table, in form order, and keeps typed words as typed", async () => {
    const p = await import("./print");
    const blocks = p.layoutDetails(
      [
        { label: "Measurements", value: "", kind: "heading" },
        { label: "Length", value: "40 inch", measure: true },
        { label: "Sleeve", value: "24 ready" },
        { label: "Chest", value: "42 inch", measure: true },
      ],
      [],
    );
    expect(blocks.map((b) => b.type)).toEqual(["heading", "grid"]);
    expect(blocks[1]).toEqual({ type: "grid", cells: [{ label: "Length", value: "40 inch" }, { label: "Sleeve", value: "24 ready" }, { label: "Chest", value: "42 inch" }] });
    const num = { key: "l", label: "Length", type: "number", required: false, unit: "inch" } as import("@/db/schema").FieldDef;
    expect(it_.displayValue(num, "40")).toBe("40 inch");
    expect(it_.displayValue(num, "17 1/2")).toBe("17 1/2 inch");
    expect(it_.displayValue(num, "24 ready")).toBe("24 ready"); // words stay as typed, no unit tacked on
    expect(it_.displayValue(num, "e")).toBe("e");
  });
});

describe("tailor slip", () => {
  it("repeats the measurements in short names with their notes, and has no dates", async () => {
    const p = await import("./print");
    const pdf = await import("./pdf");
    const a = m.createMaster({ name: "SlipMaster", pin: "3333A" });
    const fields = [
      { key: "fabric", label: "Fabric", type: "text", required: false },
      { key: "h", label: "Measurements", type: "heading", required: false },
      { key: "length", label: "Length", type: "text", required: false, short: "L" },
      { key: "chest", label: "Chest", type: "number", required: false, short: "Ch", unit: "inch" },
      { key: "sleeve", label: "Sleeve", type: "text", required: false },
      { key: "mnotes", label: "Measurements notes", type: "longtext", required: false },
    ] as import("@/db/schema").FieldDef[];
    const it = item(fields, []);
    it.values = { fabric: "Silk", length: "40", chest: "42 1/2", sleeve: "24 ready", mnotes: "Loose at the waist\nShorter sleeve" };
    const id = o.createOrder({ ...input(a, "Hussain", "2099-03-05"), designNumber: "H-2" }, [it]);
    const data = p.buildPrintData(id)!;
    const slip = data.sheets[0].items[0].slip!;
    expect(slip.cells).toEqual([
      { label: "L", value: "40" },
      { label: "Ch", value: "42 1/2 inch" }, // a plain number gets its unit
      { label: "Sleeve", value: "24 ready" }, // no short name: the full name
    ]);
    expect(slip.notes).toEqual(["Loose at the waist\nShorter sleeve"]);
    expect(JSON.stringify(slip)).not.toMatch(/2099|2098/); // no date on the slip
    const file = await pdf.renderOrderPdf(data);
    expect(file.subarray(0, 5).toString()).toBe("%PDF-");

    // an item with no measurements has no slip
    const id2 = o.createOrder(input(a, "NoSlip"), [item([{ key: "fabric", label: "Fabric", type: "text", required: false }] as import("@/db/schema").FieldDef[], [])]);
    expect(p.buildPrintData(id2)!.sheets[0].items[0].slip).toBeUndefined();

    // short names are kept on text and number fields only
    const rows = t.rowsToFields([
      { key: "", label: "Chest", type: "number", required: "optional", unit: "", short: " Ch " },
      { key: "", label: "Notes", type: "longtext", required: "optional", unit: "", short: "N" },
    ]);
    expect(rows[0].short).toBe("Ch");
    expect(rows[1].short).toBeUndefined();
  });
});

describe("links in WhatsApp messages", () => {
  it("uses APP_URL, or LINK_URL when it is set, and puts the link on a line of its own", async () => {
    const { linkBase } = await import("./config");
    expect(linkBase("http://107.132.134.154:3002", undefined)).toBe("http://107.132.134.154:3002");
    expect(linkBase("https://orders.example.com/", undefined)).toBe("https://orders.example.com");
    expect(linkBase("http://107.132.134.154:3002", "https://107-132-134-154.sslip.io:8443/")).toBe("https://107-132-134-154.sslip.io:8443");
    expect(linkBase("http://107.132.134.154:3002", "  ")).toBe("http://107.132.134.154:3002");
    const text = w.messages.newOrder({ masterName: "Nasim", token: "tok123", orderNumber: 1, customer: "Hamza", karigarDue: "2026-12-07" });
    expect(text.split("\n")).toContain(w.masterLink("tok123"));
  });
});
