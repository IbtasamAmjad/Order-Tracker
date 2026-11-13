import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_URL = ":memory:";
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `designs-test-${Date.now()}`);

let d: typeof import("./designs");
let o: typeof import("./orders");
let m: typeof import("./masters");
let s: typeof import("./stages");

beforeAll(async () => {
  const { db } = await import("@/db");
  migrate(db, { migrationsFolder: "./drizzle" });
  d = await import("./designs");
  o = await import("./orders");
  m = await import("./masters");
  s = await import("./stages");
});

async function picture(colour: string) {
  const sharp = (await import("sharp")).default;
  const buf = await sharp({ create: { width: 40, height: 40, channels: 3, background: colour } }).png().toBuffer();
  return new File([new Uint8Array(buf)], "design.png", { type: "image/png" });
}

const newItem = () => ({
  templateId: 0,
  label: "Sherwani",
  snapshot: { templateName: "Sherwani", path: "Men > Sherwani", colour: "#000000", version: 1, fields: [], stages: [] },
  values: {},
});

describe("design library", () => {
  it("keeps design numbers with pictures, each number once, and finds one by its number", async () => {
    const a = d.createDesign({ name: "NS-1042", notes: "gold thread" });
    const c = d.createDesign({ name: "Hidden one" });
    expect(await d.addDesignPictures(a, [await picture("red"), await picture("blue")])).toBe(2);
    expect(await d.addDesignPictures(a, [new File([new Uint8Array([1, 2, 3])], "bad.png")])).toBe(0); // not a picture: skipped
    expect(d.getDesign(a)!.photoIds).toHaveLength(2);
    expect(() => d.createDesign({ name: "  " })).toThrow();
    expect(() => d.createDesign({ name: " ns-1042 " })).toThrow(/already in your list/); // the same number twice
    expect(d.designByName(" ns-1042")!.id).toBe(a); // capitals and spaces do not matter
    expect(d.designByName("nope")).toBeNull();
    d.updateDesign(a, { name: "NS-1042", notes: "changed" }); // keeping its own number is fine

    // hidden designs are left out of the picker
    d.updateDesign(c, { name: "Hidden one", active: false });
    expect(d.listDesigns({ activeOnly: true }).map((x) => x.name)).not.toContain("Hidden one");
    expect(d.listDesigns().map((x) => x.name)).toContain("Hidden one");
  });

  it("copies the pictures onto the item, swaps them for another design, and never touches other customers", async () => {
    const master = m.createMaster({ name: "DesignMaster", pin: "4444A" });
    const input = { customerName: "Zed", myDueDate: "2099-01-01", karigarDueDate: "2099-02-01", masterId: master, details: "" };
    const orderId = o.createOrder(input, [newItem()]);
    const other = o.createOrder({ ...input, customerName: "Other" }, [newItem()]);
    const item = o.listItems(orderId)[0];
    const otherItem = o.listItems(other)[0];

    const one = d.createDesign({ name: "One" });
    const two = d.createDesign({ name: "Two" });
    await d.addDesignPictures(one, [await picture("red"), await picture("green")]);
    await d.addDesignPictures(two, [await picture("blue")]);

    expect(await d.attachDesign(orderId, item.id, one)).toBe(2);
    expect(o.listItems(orderId)[0].designId).toBe(one);
    const mine = s.referencePhotos(item.id);
    expect(mine).toHaveLength(2);
    expect(mine.every((p) => p.fromDesignId === one && p.fieldKey === null)).toBe(true);

    // the pictures are on the printed sheet and are what the master sees as the chosen design
    const pr = await import("./print");
    expect(pr.buildPrintData(orderId)!.sheets[0].items[0].photoIds).toEqual(mine.map((p) => p.id));

    // the same design again: nothing is added twice
    expect(await d.attachDesign(orderId, item.id, one)).toBe(0);
    expect(s.referencePhotos(item.id)).toHaveLength(2);

    // another design replaces the first design's pictures; a picture added by hand would stay (it has no design)
    expect(await d.attachDesign(orderId, item.id, two)).toBe(1);
    const after = s.referencePhotos(item.id);
    expect(after).toHaveLength(1);
    expect(after[0].fromDesignId).toBe(two);

    // the cross on a picture of the item takes just that picture off (and only a reference picture of that item)
    const on = s.referencePhotos(item.id);
    const on_ = await import("./order-notes");
    await on_.removeItemPicture(otherItem.id, on[0].id); // another item's id: nothing happens
    expect(s.referencePhotos(item.id)).toHaveLength(on.length);

    // removing a picture from the library leaves the customer's copy
    const lib = d.getDesign(two)!;
    await d.removeDesignPicture(two, lib.photoIds[0]);
    expect(d.getDesign(two)!.photoIds).toHaveLength(0);
    expect(s.referencePhotos(item.id)).toHaveLength(1);

    await on_.removeItemPicture(item.id, on[0].id); // the cross on the item's own picture
    expect(s.referencePhotos(item.id)).toHaveLength(0);

    // other customers are untouched; choosing none takes the pictures off
    expect(s.referencePhotos(otherItem.id)).toHaveLength(0);
    await d.attachDesign(orderId, item.id, null);
    expect(s.referencePhotos(item.id)).toHaveLength(0);
    expect(o.listItems(orderId)[0].designId).toBeNull();
  });
});
