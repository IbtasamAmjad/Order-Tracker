import { describe, expect, it } from "vitest";
import { colourName } from "./colour-name";

describe("colour names", () => {
  it("shows a HEX colour as the nearest everyday name", () => {
    expect(colourName("#800000")).toBe("Maroon");
    expect(colourName("#923535")).toBe("Brick red");
    expect(colourName("#000000")).toBe("Black");
    expect(colourName("#FFFFFF")).toBe("White");
    expect(colourName("#1F2A5C")).toBe("Navy");
    expect(colourName("#87CEEB")).toBe("Sky blue");
    expect(colourName("#1f5fd1")).toBe("Blue"); // capitals do not matter
  });

  it("leaves anything that is not a HEX colour as it is, and handles empty", () => {
    expect(colourName("Ivory silk")).toBe("Ivory silk");
    expect(colourName("")).toBe("");
    expect(colourName(null)).toBe("");
  });
});
