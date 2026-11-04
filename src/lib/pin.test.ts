import { describe, expect, it } from "vitest";
import { clearFailures, hashPin, isLocked, recordFailure, verifyPin } from "./pin";
import { colourBand, daysUntil } from "./colour";

describe("pin", () => {
  it("hashes and verifies, case-insensitive", () => {
    const h = hashPin("1234A");
    expect(h).not.toContain("1234A");
    expect(verifyPin("1234a", h)).toBe(true);
    expect(verifyPin("1234B", h)).toBe(false);
  });
  it("locks after 5 wrong attempts", () => {
    for (let i = 0; i < 5; i++) recordFailure("k");
    expect(isLocked("k")).toBe(true);
    clearFailures("k");
    expect(isLocked("k")).toBe(false);
  });
});

describe("colour", () => {
  const now = new Date(2026, 10, 4);
  it("computes bands", () => {
    expect(daysUntil("2026-11-09", now)).toBe(5);
    expect(colourBand("2026-11-02", false, now)).toBe("red"); // overdue
    expect(colourBand("2026-12-30", true, now)).toBe("red"); // first in list
    expect(colourBand("2026-11-15", false, now)).toBe("green");
    expect(colourBand("2027-01-01", false, now)).toBe("blue");
  });
});
