import { describe, expect, it } from "vitest";
import { checkPassword, createSession, safeNext, verifySession } from "./admin-session";

const SECRET = "a-secret-that-is-long-enough-123";

describe("admin session", () => {
  it("accepts a fresh signed session", async () => {
    expect(await verifySession(await createSession(SECRET), SECRET)).toBe(true);
  });

  it("rejects missing, tampered, expired, wrong-key and weak-key sessions", async () => {
    const now = 1_000_000_000_000;
    const good = await createSession(SECRET, now);
    expect(await verifySession(undefined, SECRET, now)).toBe(false);
    expect(await verifySession("", SECRET, now)).toBe(false);
    expect(await verifySession("garbage", SECRET, now)).toBe(false);
    // change the expiry date but keep the old signature
    const [, sig] = good.split(".");
    expect(await verifySession(`${now + 999_999_999_999}.${sig}`, SECRET, now)).toBe(false);
    expect(await verifySession(good, "another-secret-that-is-long-1", now)).toBe(false);
    expect(await verifySession(good, SECRET, now + 31 * 86_400_000)).toBe(false); // expired after 30 days
    expect(await verifySession(good, SECRET, now + 29 * 86_400_000)).toBe(true);
    const short = await createSession("short", now);
    expect(await verifySession(short, "short", now)).toBe(false); // refuses a too-short key
    expect(await verifySession(good, undefined, now)).toBe(false);
  });

  it("checks the password, and fails closed when none is set", () => {
    expect(checkPassword("right", "right")).toBe(true);
    expect(checkPassword("wrong", "right")).toBe(false);
    expect(checkPassword("", "right")).toBe(false);
    expect(checkPassword("anything", undefined)).toBe(false);
    expect(checkPassword("", "")).toBe(false);
  });

  it("only goes back to admin pages after login", () => {
    expect(safeNext("/admin/orders/5")).toBe("/admin/orders/5");
    expect(safeNext("/admin")).toBe("/admin");
    expect(safeNext("https://evil.example")).toBe("/admin");
    expect(safeNext("//evil.example")).toBe("/admin");
    expect(safeNext("/m/abc")).toBe("/admin");
    expect(safeNext("/admin/login")).toBe("/admin");
    expect(safeNext(null)).toBe("/admin");
  });
});
