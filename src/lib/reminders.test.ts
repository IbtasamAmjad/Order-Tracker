import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { cleanNumber, masterLink, messages, waLink } from "./whatsapp";

process.env.DATABASE_URL = ":memory:";

let o: typeof import("./orders");
let m: typeof import("./masters");
let r: typeof import("./reminders");
let n: typeof import("./notify");
let t: typeof import("./templates");
let s: typeof import("./stages");

beforeAll(async () => {
  const { db } = await import("@/db");
  migrate(db, { migrationsFolder: "./drizzle" });
  o = await import("./orders");
  m = await import("./masters");
  r = await import("./reminders");
  n = await import("./notify");
  t = await import("./templates");
  s = await import("./stages");
});

const DAY = 86_400_000;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const inDays = (days: number) => ymd(new Date(Date.now() + days * DAY));
const mk = (masterId: number, customer: string, due: string) =>
  o.createOrder({ customerName: customer, myDueDate: "2031-07-07", karigarDueDate: due, masterId, details: "" });

describe("whatsapp links", () => {
  it("cleans numbers and encodes the text", () => {
    expect(cleanNumber("+92 300-1234567")).toBe("923001234567");
    expect(cleanNumber(null)).toBe("");
    const link = waLink("+92 300 1234567", "Hello & welcome #1");
    expect(link).toBe("https://wa.me/923001234567?text=Hello%20%26%20welcome%20%231");
    expect(waLink(null, "hi")).toBe("https://wa.me/?text=hi"); // no number saved: WhatsApp lets Anas pick the chat
  });

  it("messages never contain My due date and always carry the master's own link", () => {
    const c = { masterName: "Naseem", token: "TOK", orderNumber: 7, customer: "Usha" };
    const all = [
      messages.newOrder({ ...c, karigarDue: "2030-01-02" }),
      messages.movedUp(c),
      messages.updated(c),
      messages.cancelled(c),
      messages.photoApproved({ ...c, what: "Sherwani - Embroidery" }),
      messages.photoRejected({ ...c, what: "Sherwani - Embroidery", comment: "Wrong thread" }),
      messages.overdue({ ...c, dueDate: "2030-01-02" }),
      messages.dueSoon({ ...c, days: 1 }),
      messages.stale({ ...c, days: 9 }),
    ];
    expect(all.every((x) => x.includes("#7"))).toBe(true);
    expect(all.filter((x) => x.includes(masterLink("TOK"))).length).toBe(all.length - 1); // cancelled needs no link
    expect(messages.dueSoon({ ...c, days: 1 })).toContain("1 day.");
  });
});

describe("flags and reminders", () => {
  it("flags overdue, due soon and stale orders", () => {
    const now = new Date();
    expect(r.orderFlags(inDays(-2), now, now)).toMatchObject({ overdue: true, daysOverdue: 2, stale: false });
    expect(r.orderFlags(inDays(3), now, now)).toMatchObject({ overdue: false, dueSoon: true, daysLeft: 3 });
    expect(r.orderFlags(inDays(40), now, now)).toMatchObject({ overdue: false, dueSoon: false });
    const old = new Date(now.getTime() - 8 * DAY);
    expect(r.orderFlags(inDays(40), old, now)).toMatchObject({ stale: true, idleDays: 8 });
    expect(r.needsReminder(r.orderFlags(inDays(40), now, now))).toBe(false);
  });

  it("lists only active orders that need a nudge, with a WhatsApp message", () => {
    const master = m.createMaster({ name: "Rem", pin: "1", whatsappNumber: "+92 300 111" });
    const late = mk(master, "Late", inDays(-3));
    const soon = mk(master, "Soon", inDays(2));
    mk(master, "Fine", inDays(60));
    const cancelled = mk(master, "Cancelled", inDays(-5));
    o.setStatus(cancelled, "cancelled");

    const list = r.remindersList().filter((x) => x.masterName === "Rem");
    expect(list.map((x) => x.customerName)).toEqual(["Late", "Soon"]); // earliest due first, "Fine" and cancelled left out
    expect(list[0]).toMatchObject({ orderId: late, hasNumber: true, reasons: ["Overdue by 3 days"] });
    expect(list[0].link).toContain("https://wa.me/92300111?text=");
    expect(decodeURIComponent(list[0].link)).toContain("was due on");
    expect(list[1].orderId).toBe(soon);

    // in ten days an untouched "Fine" order has gone stale
    const later = r.remindersList(new Date(Date.now() + 10 * DAY)).filter((x) => x.masterName === "Rem");
    expect(later.some((x) => x.customerName === "Fine" && x.reasons.some((y) => y.startsWith("No update")))).toBe(true);
  });

  it("progress resets the no-update clock", () => {
    const main = t.createMainCategory("R" + Math.random(), "#000000");
    t.createSubCategory(main, "Thing", "#111111");
    const tplId = t.listCategoryTree().find((c) => c.id === main)!.subs[0].template.id;
    t.saveTemplate(tplId, [], t.rowsToStages([{ key: "", label: "Cutting", photo: "none" }, { key: "", label: "Sewing", photo: "none" }]));
    const master = m.createMaster({ name: "Clock", pin: "1" });
    const id = o.createOrder(
      { customerName: "Clock", myDueDate: "2031-01-01", karigarDueDate: inDays(60), masterId: master, details: "" },
      [{ templateId: tplId, label: "Thing", snapshot: t.templateForItem(tplId)!.snapshot, values: {} }],
    );
    const before = r.lastActivityAt(id).getTime();
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        const itemId = o.listItems(id)[0].id;
        expect(s.completeStage({ by: "admin" }, itemId, "cutting")).toEqual({ ok: true });
        expect(r.lastActivityAt(id).getTime()).toBeGreaterThan(before);
        resolve();
      }, 5),
    );
  });
});

describe("notices", () => {
  it("builds a message for each master of an order, and for a reviewed photo", () => {
    const master = m.createMaster({ name: "Notice", pin: "1", whatsappNumber: "0300 5550000" });
    const id = mk(master, "Cust", inDays(30));
    const [notice] = n.orderNotices("new", id);
    expect(notice).toMatchObject({ masterName: "Notice", hasNumber: true });
    expect(decodeURIComponent(notice.link)).toContain("new order #");
    expect(decodeURIComponent(n.orderNotices("cancelled", id)[0].link)).toContain("CANCELLED");
    expect(n.orderNotices("new", 999999)).toEqual([]);
    expect(n.photoNotice(999999)).toBeNull();
  });

  it("gives one button for every master when an order has several", () => {
    const a = m.createMaster({ name: "Two A", pin: "1", whatsappNumber: "0300 1" });
    const b = m.createMaster({ name: "Two B", pin: "2" });
    const id = o.createOrder({ customerName: "Shared", myDueDate: "2031-07-07", karigarDueDate: inDays(30), masterId: a, masterIds: [a, b], details: "" });
    const notices = n.orderNotices("updated", id);
    expect(notices.map((x) => x.masterName)).toEqual(["Two A", "Two B"]);
    expect(notices.map((x) => x.hasNumber)).toEqual([true, false]);
  });
});
