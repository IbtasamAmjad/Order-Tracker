import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

process.env.DATABASE_URL = ":memory:";
process.env.UPLOAD_DIR = "./data/test-uploads";

let o: typeof import("./orders");
let m: typeof import("./masters");
let f: typeof import("./order-files");

beforeAll(async () => {
  const { db } = await import("@/db");
  migrate(db, { migrationsFolder: "./drizzle" });
  o = await import("./orders");
  m = await import("./masters");
  f = await import("./order-files");
});

const pdf = (body = "%PDF-1.4 test", name = "form.pdf") => new File([body], name, { type: "application/pdf" });

describe("order PDF files", () => {
  it("accepts a real PDF, refuses other files, and lists and removes them", async () => {
    expect(await f.pdfProblem(pdf())).toBeNull();
    expect(await f.pdfProblem(pdf("hello", "fake.pdf"))).toMatch(/not a PDF/);
    expect(await f.pdfProblem(new File([new Uint8Array(f.MAX_PDF_BYTES + 1)], "big.pdf"))).toMatch(/too big/);

    const master = m.createMaster({ name: "Pdf master" + Math.random(), pin: "1" });
    const orderId = o.createOrder(
      { customerName: "Pdf customer", myDueDate: "2026-12-01", karigarDueDate: "2026-11-20", masterId: master, details: "" },
      [],
    );
    const id = await f.addOrderPdf(orderId, pdf());
    expect(f.listOrderFiles(orderId).map((x) => x.name)).toEqual(["form.pdf"]);
    expect(f.orderFile(orderId, id)?.id).toBe(id);
    expect(f.orderFile(orderId + 1, id)).toBeNull(); // only through its own order

    await f.removeOrderFile(orderId, id);
    expect(f.listOrderFiles(orderId)).toEqual([]);
  });
});
