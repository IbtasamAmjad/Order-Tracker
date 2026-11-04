import { APP_URL } from "./config";

// Manual click-to-send: we build a wa.me link with the text already typed in.
// Anas taps it, WhatsApp opens, he presses send. No API account needed.
// (Swapping this for the WhatsApp Cloud API later only needs a new "send" function here.)

/** Digits only, e.g. "+92 300-1234567" -> "923001234567". Empty if nothing usable. */
export function cleanNumber(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

export function waLink(number: string | null | undefined, text: string): string {
  return `https://wa.me/${cleanNumber(number)}?text=${encodeURIComponent(text)}`;
}

export const masterLink = (token: string) => `${APP_URL}/m/${token}`;

type Ctx = { masterName: string; token: string; orderNumber: number; customer: string };

// NOTE: never put "My due date" in a message: masters must not see it.
export const messages = {
  newOrder: (c: Ctx & { karigarDue: string }) =>
    `Hello ${c.masterName}, you have a new order #${c.orderNumber} for ${c.customer}. Due date: ${c.karigarDue}. Please open your list: ${masterLink(c.token)}`,
  movedUp: (c: Ctx) =>
    `Hello ${c.masterName}, order #${c.orderNumber} (${c.customer}) is now more urgent. Please do it first. ${masterLink(c.token)}`,
  updated: (c: Ctx) =>
    `Hello ${c.masterName}, order #${c.orderNumber} (${c.customer}) was changed. Please check it again. ${masterLink(c.token)}`,
  cancelled: (c: Ctx) =>
    `Hello ${c.masterName}, order #${c.orderNumber} (${c.customer}) is CANCELLED. Please stop work on it.`,
  photoApproved: (c: Ctx & { what: string }) =>
    `Hello ${c.masterName}, your photo for order #${c.orderNumber} (${c.what}) is approved. You can mark it complete. ${masterLink(c.token)}`,
  photoRejected: (c: Ctx & { what: string; comment: string }) =>
    `Hello ${c.masterName}, your photo for order #${c.orderNumber} (${c.what}) was not accepted: ${c.comment}. Please send a new photo. ${masterLink(c.token)}`,
  overdue: (c: Ctx & { dueDate: string }) =>
    `Hello ${c.masterName}, order #${c.orderNumber} (${c.customer}) was due on ${c.dueDate}. Please update me today. ${masterLink(c.token)}`,
  dueSoon: (c: Ctx & { days: number }) =>
    `Hello ${c.masterName}, order #${c.orderNumber} (${c.customer}) is due in ${c.days} day${c.days === 1 ? "" : "s"}. Please update me. ${masterLink(c.token)}`,
  stale: (c: Ctx & { days: number }) =>
    `Hello ${c.masterName}, order #${c.orderNumber} (${c.customer}) has had no update for ${c.days} days. Please update me. ${masterLink(c.token)}`,
};
