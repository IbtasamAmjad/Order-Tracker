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

/** What a message says about the order. Only the Karigar due date: masters must never see My due date. */
export type OrderInfo = {
  design: string | null;
  dueDate: string; // YYYY-MM-DD
  items: { label: string; state: "sent" | "ready" | "making"; stage: string | null }[];
  summary: string; // "1 of 2 items finished. 1 left to make."
};

/** "2026-11-05" -> "5 November 2026". */
export function plainDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
const header = (c: Ctx, info?: OrderInfo) => `Order #${c.orderNumber} - ${c.customer}${info?.design ? ` (design ${info.design})` : ""}`;

/** One line for each item: what it is and where it stands, in simple words. */
function itemLines(info?: OrderInfo): string {
  if (!info || info.items.length === 0) return "";
  const line = (i: OrderInfo["items"][number]) =>
    i.state === "sent" ? `- ${i.label}: already sent` : i.state === "ready" ? `- ${i.label}: finished, ready to send` : `- ${i.label}: still to make${i.stage ? ` (now at ${i.stage})` : ""}`;
  return `${info.items.map(line).join("\n")}${info.summary ? `\n${info.summary}` : ""}`;
}

/** Joins the lines; an empty text "" is kept as a blank line, `false` or undefined leaves a line out. */
const lines = (...parts: (string | false | undefined)[]) => parts.filter((p): p is string => p !== false && p !== undefined).join("\n");

/** Everything is finished (some may be sent): nothing is left to make, only to send. */
const nothingToMake = (info?: OrderInfo) => !!info && info.items.length > 0 && info.items.every((i) => i.state !== "making");

// NOTE: never put "My due date" in a message: masters must not see it.
export const messages = {
  newOrder: (c: Ctx & { karigarDue: string; info?: OrderInfo }) =>
    lines(
      `Hello ${c.masterName},`,
      "",
      `You have a new order.`,
      header(c, c.info),
      `Due date: ${plainDate(c.karigarDue)}`,
      c.info && c.info.items.length > 0 && `Items: ${c.info.items.map((i) => i.label).join(", ")}`,
      "",
      `Please open your list: ${masterLink(c.token)}`,
    ),
  movedUp: (c: Ctx & { info?: OrderInfo }) =>
    lines(
      `Hello ${c.masterName},`,
      "",
      `This order is now more urgent. Please do it first.`,
      header(c, c.info),
      c.info && `Due date: ${plainDate(c.info.dueDate)}`,
      c.info && c.info.items.length > 0 && "",
      c.info && itemLines(c.info),
      "",
      `Your list: ${masterLink(c.token)}`,
    ),
  updated: (c: Ctx) =>
    `Hello ${c.masterName}, order #${c.orderNumber} (${c.customer}) was changed. Please check it again. ${masterLink(c.token)}`,
  cancelled: (c: Ctx) =>
    `Hello ${c.masterName}, order #${c.orderNumber} (${c.customer}) is CANCELLED. Please stop work on it.`,
  photoApproved: (c: Ctx & { what: string }) =>
    `Hello ${c.masterName}, your photo for order #${c.orderNumber} (${c.what}) is approved. You can mark it complete. ${masterLink(c.token)}`,
  photoRejected: (c: Ctx & { what: string; comment: string }) =>
    `Hello ${c.masterName}, your photo for order #${c.orderNumber} (${c.what}) was not accepted: ${c.comment}. Please send a new photo. ${masterLink(c.token)}`,
  overdue: (c: Ctx & { dueDate: string; days?: number; info?: OrderInfo }) =>
    lines(
      `Hello ${c.masterName},`,
      "",
      `This order is LATE.`,
      header(c, c.info),
      `Due date: ${plainDate(c.dueDate)}`,
      c.days !== undefined && `Late by ${days(c.days)}`,
      c.info && c.info.items.length > 0 && "",
      c.info && c.info.items.length > 0 && "Where it stands:",
      c.info && itemLines(c.info),
      "",
      nothingToMake(c.info)
        ? `Please send it today (open your Cart) and let me know.`
        : `Please finish what is left and send me an update today.`,
      `Your list: ${masterLink(c.token)}`,
    ),
  dueSoon: (c: Ctx & { days: number; info?: OrderInfo }) =>
    lines(
      `Hello ${c.masterName},`,
      "",
      `This order is due ${c.days === 0 ? "today" : `in ${days(c.days)}`}.`,
      header(c, c.info),
      c.info && `Due date: ${plainDate(c.info.dueDate)}`,
      c.info && c.info.items.length > 0 && "",
      c.info && c.info.items.length > 0 && "Where it stands:",
      c.info && itemLines(c.info),
      "",
      nothingToMake(c.info) ? `Please send it on time (open your Cart) and let me know.` : `Please finish it on time and send me an update.`,
      `Your list: ${masterLink(c.token)}`,
    ),
  stale: (c: Ctx & { days: number; info?: OrderInfo }) =>
    lines(
      `Hello ${c.masterName},`,
      "",
      `I have not had an update on this order for ${days(c.days)}.`,
      header(c, c.info),
      c.info && `Due date: ${plainDate(c.info.dueDate)}`,
      c.info && c.info.items.length > 0 && "",
      c.info && c.info.items.length > 0 && "Where it stands:",
      c.info && itemLines(c.info),
      "",
      `Please open your list, update the work, and let me know.`,
      `Your list: ${masterLink(c.token)}`,
    ),
};
