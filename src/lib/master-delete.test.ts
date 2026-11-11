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

describe("deleting a master", () => {
  it("deletes one with no work, refuses one with a customer", () => {
    const free = m.createMaster({ name: "Free" + Math.random(), pin: "1" });
    expect(m.deleteMaster(free)).toBe("deleted");
    expect(m.listMasters().some((x) => x.id === free)).toBe(false);

    const busy = m.createMaster({ name: "Busy" + Math.random(), pin: "1" });
    o.createOrder({ customerName: "C", myDueDate: "2027-01-02", karigarDueDate: "2027-01-01", masterId: busy, details: "" }, []);
    expect(m.deleteMaster(busy)).toBe("has-work");
    expect(m.listMasters().some((x) => x.id === busy)).toBe(true);
  });
});
