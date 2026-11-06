import { eq } from "drizzle-orm";
import { db } from "@/db";
import { masters } from "@/db/schema";
import { hashPin, newToken } from "./pin";

export function createMaster(input: { name: string; pin: string }) {
  return db
    .insert(masters)
    .values({
      name: input.name,
      token: newToken(),
      pinHash: hashPin(input.pin),
      sessionSecret: newToken(),
    })
    .returning({ id: masters.id })
    .get().id;
}

export function listMasters() {
  return db.select().from(masters).orderBy(masters.name).all();
}

export function getMasterByToken(token: string) {
  return db.select().from(masters).where(eq(masters.token, token)).get();
}

/** Admin sets a new PIN. Logs the master out everywhere. */
export function setPin(id: number, pin: string) {
  db.update(masters).set({ pinHash: hashPin(pin), sessionSecret: newToken() }).where(eq(masters.id, id)).run();
}

/** Lost link: issue a new URL token. The old link stops working. */
export function reissueLink(id: number) {
  db.update(masters).set({ token: newToken(), sessionSecret: newToken() }).where(eq(masters.id, id)).run();
}

export function setActive(id: number, active: boolean) {
  db.update(masters).set({ active }).where(eq(masters.id, id)).run();
}
