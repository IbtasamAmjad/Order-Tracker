import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { PIN_LOCK_MINUTES, PIN_MAX_ATTEMPTS } from "./config";

// PINs are case-insensitive so "1234a" works on a phone keyboard.
const normalise = (pin: string) => pin.trim().toUpperCase();

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(normalise(pin), salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(normalise(pin), Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}

export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

// --- rate limiting (in memory; resets on restart, fine at this scale) ---
const attempts = new Map<string, { count: number; lockedUntil: number }>();

export function isLocked(key: string, now = Date.now()): boolean {
  const a = attempts.get(key);
  return !!a && a.lockedUntil > now;
}

export function recordFailure(key: string, now = Date.now()): void {
  const a = attempts.get(key) ?? { count: 0, lockedUntil: 0 };
  a.count += 1;
  if (a.count >= PIN_MAX_ATTEMPTS) {
    a.count = 0;
    a.lockedUntil = now + PIN_LOCK_MINUTES * 60_000;
  }
  attempts.set(key, a);
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}
