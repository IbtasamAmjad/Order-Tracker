import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

/** Small office settings kept as key / value text. */
export function getSetting(key: string): string {
  return db.select().from(appSettings).where(eq(appSettings.key, key)).get()?.value ?? "";
}

export function setSetting(key: string, value: string) {
  if (!value) {
    db.delete(appSettings).where(eq(appSettings.key, key)).run();
    return;
  }
  db.insert(appSettings).values({ key, value }).onConflictDoUpdate({ target: appSettings.key, set: { value } }).run();
}

/** The office WhatsApp number (digits only) that masters send their questions to. Empty = not set yet. */
export const officeWhatsapp = () => getSetting("office_whatsapp");
