import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

process.env.DATABASE_URL = ":memory:";

let o: typeof import("./orders");
let m: typeof import("./masters");

beforeAll(async () => {
  const { db } = await import("@/db");
  migrate(db, { migrationsFolder: "./drizzle" });
  o = await import("./orders");
  m = await import("./masters");
});

const input = (masterId: number, name: string, karigar = "2099-01-01") => ({
  customerName: name,
  myDueDate: "2099-01-01",
  karigarDueDate: karigar,
  masterId,
  details: "",
});

describe("orders", () => {
  it("numbers orders in the order they are added and isolates masters", () => {
    const a = m.createMaster({ name: "A", pin: "1234A" });
    const b = m.createMaster({ name: "B", pin: "9999" });
    const o1 = o.createOrder(input(a, "One"));
    const o2 = o.createOrder(input(a, "Two"));
    const o3 = o.createOrder(input(a, "Three"));
    const ob = o.createOrder(input(b, "Bee"));

    expect(o.getOrder(o1)!.orderNumber).toBeLessThan(o.getOrder(o2)!.orderNumber);

    // master B cannot see or open A's orders
    expect(o.masterDashboard(b).active.map((x) => x.customerName)).toEqual(["Bee"]);
    expect(o.masterOrder(b, o1)).toBeNull();
    expect(o.masterComplete(b, o1)).toEqual({ ok: false, reason: "not-found" });
    expect(o.masterOrder(a, ob)).toBeNull();

    // master data never includes My due date
    const dash = o.masterDashboard(a).active[0];
    expect("myDueDate" in dash).toBe(false);

    // move order 3 to position 1
    o.moveOrder(o3, "up");
    o.moveOrder(o3, "up");
    expect(o.masterDashboard(a).active.map((x) => x.customerName)).toEqual(["Three", "One", "Two"]);
    expect(o.masterDashboard(a).active[0].badge).toBe("New"); // never opened yet
    // moving B's order does not touch A's list
    expect(o.masterDashboard(b).active).toHaveLength(1);
  });

  it("lets a master complete any of his orders, in any order", () => {
    const a = m.createMaster({ name: "C", pin: "1" });
    const first = o.createOrder(input(a, "First"));
    const second = o.createOrder(input(a, "Second"));
    expect(o.masterOrder(a, second)!.canComplete).toBe(true);
    expect(o.masterComplete(a, second)).toEqual({ ok: true });
    expect(o.masterComplete(a, first)).toEqual({ ok: true });
  });

  it("can give an order to several masters, who all see it and can work on it", () => {
    const a = m.createMaster({ name: "Two A", pin: "1" });
    const b = m.createMaster({ name: "Two B", pin: "2" });
    const c = m.createMaster({ name: "Not on it", pin: "3" });
    const id = o.createOrder({ ...input(a, "Shared"), masterIds: [a, b] });
    expect(o.masterOrder(a, id)).not.toBeNull();
    expect(o.masterOrder(b, id)).not.toBeNull();
    expect(o.masterOrder(c, id)).toBeNull(); // another master still never sees it
    expect(o.masterDashboard(b).active.map((r) => r.id)).toContain(id);
    expect(o.listAdminOrders({ masterId: b, view: "active" }).map((r) => r.id)).toContain(id);
    expect(o.listAdminOrders({ view: "active" }).find((r) => r.id === id)!.masterName).toBe("Two A, Two B");
    // Admin changes the list: b leaves, c joins
    o.updateOrder(id, { ...input(a, "Shared"), masterIds: [a, c] });
    expect(o.masterOrder(b, id)).toBeNull();
    expect(o.masterOrder(c, id)).not.toBeNull();
    expect(o.masterComplete(c, id)).toEqual({ ok: true });
  });

  it("the Urgent / Coming due / On Time tag follows the deadline, not the place in the list", () => {
    const a = m.createMaster({ name: "Band", pin: "1" });
    const far = o.createOrder(input(a, "Far", "2099-01-01")); // first in the list, but a long way off
    const near = o.createOrder(input(a, "Near", "2000-01-01")); // overdue, second in the list
    const band = (id: number) => o.listAdminOrders({ masterId: a, view: "active" }).find((r) => r.id === id)!.band;
    expect([band(far), band(near)]).toEqual(["blue", "red"]);
    o.moveOrder(near, "up");
    expect([band(far), band(near)]).toEqual(["blue", "red"]); // moving changes nothing
    o.moveOrder(far, "up");
    expect([band(far), band(near)]).toEqual(["blue", "red"]);
    const mine = o.masterDashboard(a).active;
    expect(mine.find((r) => r.id === far)!.band).toBe("blue");
  });

  it("shows Seen / New / Updated badges", () => {
    const a = m.createMaster({ name: "D", pin: "1" });
    const id = o.createOrder(input(a, "Badge"));
    expect(o.masterDashboard(a).active[0].badge).toBe("New");
    o.markSeen(a, id);
    expect(o.masterDashboard(a).active[0].badge).toBeNull();
    expect(o.getOrder(id)!.masterSeenAt).not.toBeNull();
    // changed after the master last looked
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        o.updateOrder(id, input(a, "Badge", "2099-02-02"));
        expect(o.masterDashboard(a).active[0].badge).toBe("Updated");
        resolve();
      }, 5),
    );
  });

  it("shows Moved up after the master has seen the order", () => {
    const a = m.createMaster({ name: "F", pin: "1" });
    o.createOrder(input(a, "X"));
    const y = o.createOrder(input(a, "Y"));
    o.markSeen(a, y);
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        o.moveOrder(y, "up");
        expect(o.masterDashboard(a).active[0]).toMatchObject({ customerName: "Y", badge: "Moved up" });
        resolve();
      }, 5),
    );
  });

  it("cancel -> master sees Cancelled for 15 days, then it disappears; archive hides it", () => {
    const a = m.createMaster({ name: "E", pin: "1" });
    const id = o.createOrder(input(a, "Gone"));
    expect(o.setStatus(id, "cancelled")).toBe(true);
    expect(o.masterDashboard(a).closed[0].status).toBe("cancelled");
    const later = new Date(Date.now() + 16 * 86_400_000);
    expect(o.masterDashboard(a, later).closed).toHaveLength(0);
    expect(o.masterOrder(a, id, later)).toBeNull();
    expect(o.setStatus(id, "archived")).toBe(true);
    expect(o.masterOrder(a, id)).toBeNull();
    expect(o.setStatus(id, "active" as never)).toBe(false); // no way back, no delete
  });
});
