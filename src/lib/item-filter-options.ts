// Plain data for the item filters. No database here, so the browser can import it too.

/** Where one ordered item is in production. */
export type ItemStatus = "not-started" | "in-production" | "ready" | "shipped";

export const STATUS_TEXT: Record<ItemStatus, string> = {
  "not-started": "Not started",
  "in-production": "In production",
  ready: "Ready to ship",
  shipped: "Shipped",
};

/** The choices of the status filter. "Not made yet" is everything that is not finished: not started and in production. */
export const STATUS_FILTERS: { value: string; label: string; match: ItemStatus[] }[] = [
  { value: "", label: "Any status", match: ["not-started", "in-production", "ready", "shipped"] },
  { value: "not-made", label: "Not made yet", match: ["not-started", "in-production"] },
  { value: "not-started", label: STATUS_TEXT["not-started"], match: ["not-started"] },
  { value: "in-production", label: STATUS_TEXT["in-production"], match: ["in-production"] },
  { value: "ready", label: STATUS_TEXT.ready, match: ["ready"] },
  { value: "shipped", label: STATUS_TEXT.shipped, match: ["shipped"] },
];

/** The choices of the due-date filter. Finished (ready or shipped) items are never "due": nothing is left to do on them. */
export const DUE_FILTERS: { value: string; label: string; days: number | null }[] = [
  { value: "", label: "Any due date", days: null },
  { value: "late", label: "Late", days: -1 },
  { value: "3", label: "Due in 3 days", days: 3 },
  { value: "7", label: "Due in 7 days", days: 7 },
  { value: "14", label: "Due in 14 days", days: 14 },
];

