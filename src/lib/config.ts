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

/**
 * The address that goes into WhatsApp messages and the Copy button. WhatsApp only turns an address into a tappable link
 * when it looks like a web address with a name (like orders.example.com); a bare number with a port
 * (http://107.132.134.154:3002) stays plain text. So a public IP address is written as the same address with a name
 * that the free nip.io service points back at that IP (107-132-134-154.nip.io). Set LINK_URL to use your own address
 * instead (a real domain, ideally https). Private office addresses (192.168..., 10...) and localhost are left alone.
 */
export function linkBase(appUrl: string = APP_URL, override: string | undefined = process.env.LINK_URL): string {
  const strip = (u: string) => u.replace(/\/+$/, "");
  if (override && override.trim()) return strip(override.trim());
  try {
    const u = new URL(appUrl);
    const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(u.hostname);
    if (!ip) return strip(appUrl);
    const [a, b2] = [Number(ip[1]), Number(ip[2])];
    const privateIp = a === 10 || a === 127 || a === 0 || (a === 192 && b2 === 168) || (a === 172 && b2 >= 16 && b2 <= 31) || (a === 169 && b2 === 254);
    if (privateIp) return strip(appUrl);
    return `${u.protocol}//${u.hostname.replace(/\./g, "-")}.nip.io${u.port ? `:${u.port}` : ""}`;
  } catch {
    return strip(appUrl);
  }
}

// Login cookies are marked "secure" only when the site address is https. On a plain http office network a secure
// cookie would never come back from the browser, and nobody could sign in.
export const COOKIE_SECURE = APP_URL.startsWith("https://");

// Reminders: an active order is flagged when it is overdue, due within this many days,
// or has had no progress (stage done / photo / shipment) for STALE_DAYS.
export const REMINDER_DUE_DAYS = 7;
export const STALE_DAYS = 7;
