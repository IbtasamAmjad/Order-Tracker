import { COLOUR_RULES } from "./config";

export type Band = "red" | "green" | "blue";

/** Whole days from today until a YYYY-MM-DD date (negative = overdue). */
export function daysUntil(dateStr: string, now: Date = new Date()): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const due = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / 86_400_000);
}

/**
 * Only the deadline (the Karigar due date) decides this, never the place in the list: moving an order up or down
 * does not change its tag.
 * Red (Urgent): overdue or due very soon. Green (Coming due): due in the next weeks. Blue (On Time): everything else.
 */
export function colourBand(karigarDueDate: string, now: Date = new Date()): Band {
  const days = daysUntil(karigarDueDate, now);
  if (days <= COLOUR_RULES.redWithinDays) return "red";
  if (days <= COLOUR_RULES.greenWithinDays) return "green";
  return "blue";
}

// Left band colour on order cards, and a word so colour is never the only signal.
export const BAND_CLASS: Record<Band, string> = {
  red: "border-l-thread",
  green: "border-l-leaf",
  blue: "border-l-cloth",
};

export const BAND_LABEL: Record<Band, { text: string; className: string }> = {
  red: { text: "Urgent", className: "text-thread" },
  green: { text: "Coming due", className: "text-leaf" },
  blue: { text: "On Time", className: "text-cloth" },
};
