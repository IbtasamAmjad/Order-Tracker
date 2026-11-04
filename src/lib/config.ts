// Colour rules for the order list (based on the Karigar due date).
// Red = urgent, green = coming due, blue = low priority.
export const COLOUR_RULES = {
  redWithinDays: 3, // overdue or due within this many days
  greenWithinDays: 14,
};

// Completed / cancelled orders stay visible to the master this long.
export const CLOSED_VISIBLE_DAYS = 15;

// Wrong-PIN limits (per master link, in memory).
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 5;

export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

// Reminders: an active order is flagged when it is overdue, due within this many days,
// or has had no progress (stage done / photo / shipment) for STALE_DAYS.
export const REMINDER_DUE_DAYS = 7;
export const STALE_DAYS = 7;
