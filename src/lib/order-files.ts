import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderFiles, orders } from "@/db/schema";
import { randomKey, remove, save } from "./storage";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** The PDF files chosen in a form (empty file boxes are ignored). */
export function chosenPdfs(f: FormData, field = "orderPdf"): File[] {
  return f.getAll(field).filter((x): x is File => x instanceof File && x.size > 0);
}

/** A real PDF starts with "%PDF-". Returns a message when a file is not acceptable. */
export async function pdfProblem(file: File): Promise<string | null> {
  if (file.size > MAX_PDF_BYTES) return `${file.name} is too big. A PDF can be 10 MB at most.`;
  const head = Buffer.from(await file.slice(0, 5).arrayBuffer()).toString("latin1");
  if (head !== "%PDF-") return `${file.name} is not a PDF file.`;
  return null;
}

export async function addOrderPdf(orderId: number, file: File) {
  const fileKey = randomKey(`orders/${orderId}`, "pdf");
  await save(fileKey, Buffer.from(await file.arrayBuffer()));
  const name = (file.name || "order.pdf").replace(/[\\/"]/g, "_").slice(0, 120);
  const id = db.insert(orderFiles).values({ orderId, name, fileKey, bytes: file.size }).returning({ id: orderFiles.id }).get().id;
  db.update(orders).set({ changedForMasterAt: new Date() }).where(eq(orders.id, orderId)).run(); // the master sees "Updated"
  return id;
}

export function listOrderFiles(orderId: number) {
  return db.select().from(orderFiles).where(eq(orderFiles.orderId, orderId)).orderBy(orderFiles.id).all();
}

export function orderFile(orderId: number, fileId: number) {
  return db.select().from(orderFiles).where(and(eq(orderFiles.orderId, orderId), eq(orderFiles.id, fileId))).get() ?? null;
}

export async function removeOrderFile(orderId: number, fileId: number) {
  const row = orderFile(orderId, fileId);
  if (!row) return;
  db.delete(orderFiles).where(eq(orderFiles.id, row.id)).run();
  await remove(row.fileKey);
}
