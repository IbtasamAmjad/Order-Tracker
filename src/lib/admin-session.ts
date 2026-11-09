import { createHash, timingSafeEqual } from "node:crypto";

// Admin sign-in: one password (ADMIN_PASSWORD) and a signed cookie (key: SESSION_SECRET).
// No usernames, no database. Used by the login action, the proxy and the admin routes.

export const ADMIN_COOKIE = "admin_session";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

async function sign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
  return Buffer.from(sig).toString("base64url");
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** A cookie value that says "signed in until <time>", signed so it cannot be forged. */
export async function createSession(secret: string, now = Date.now()): Promise<string> {
  const expires = now + SESSION_DAYS * 86_400_000;
  return `${expires}.${await sign(secret, String(expires))}`;
}

export async function verifySession(token: string | undefined, secret: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token || !secret || secret.length < 16) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig || !(Number(expires) > now)) return false;
  return sameText(sig, await sign(secret, expires));
}

/** Compare the typed password with the real one without leaking timing. Fails closed if none is set. */
export function checkPassword(typed: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const a = createHash("sha256").update(typed).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Only allow going back to admin pages after login (no redirects to other sites). */
export function safeNext(next: string | null | undefined): string {
  if (next === "/live") return next; // the live board for the office TV
  return next && next.startsWith("/admin") && !next.startsWith("//") && !next.startsWith("/admin/login") ? next : "/admin";
}
