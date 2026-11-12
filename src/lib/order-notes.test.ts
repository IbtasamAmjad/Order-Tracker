import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import sharp from "sharp";

process.env.DATABASE_URL = ":memory:";
process.env.UPLOAD_DIR = "./data/test-uploads";

let o: typeof import("./orders");
let m: typeof import("./masters");
let n: typeof import("./order-notes");

beforeAll(async () => {
  const { db } = await import("@/db");
  migrate(db, { migrationsFolder: "./drizzle" });
  o = await import("./orders");
  m = await import("./masters");
  n = await import("./order-notes");
});

describe("pictures under the customer notes", () => {
  it("adds, lists and removes them, only through their own order, and the master sees them only once sent", async () => {
    const master = m.createMaster({ name: "Notes master" + Math.random(), pin: "1" });
    const input = { customerName: "Notes customer", myDueDate: "2026-12-01", karigarDueDate: "2026-11-20", masterId: master, details: "see pictures" };
    const orderId = o.createOrder(input, []);
    const other = o.createOrder({ ...input, customerName: "Other" }, []);
    const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: "#c33" } }).png().toBuffer();
    const file = new File([new Uint8Array(png)], "a.png", { type: "image/png" });

    expect(await n.addNotePictures(orderId, [file, new File([], "empty.png"), new File(["not an image"], "bad.png")])).toBe(1);
    const [pic] = n.notePhotos(orderId);
    expect(n.notePhotos(orderId)).toHaveLength(1);
    expect(n.notePhotos(other)).toHaveLength(0);

    await n.removeNotePicture(other, pic.id); // wrong order: nothing happens
    expect(n.notePhotos(orderId)).toHaveLength(1);
    await n.removeNotePicture(orderId, pic.id);
    expect(n.notePhotos(orderId)).toHaveLength(0);
  });
});
