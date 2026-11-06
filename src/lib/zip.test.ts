import { describe, expect, it } from "vitest";
import { crc32 } from "node:zlib";
import { makeZip } from "./zip";

describe("zip", () => {
  it("builds a zip whose directory lists every file with the right size, checksum and place", () => {
    const files = [
      { name: "a-1.jpg", data: Buffer.from("first picture") },
      { name: "b-2.jpg", data: Buffer.alloc(5000, 7) },
      { name: "ünï.jpg", data: Buffer.from("third") },
    ];
    const zip = makeZip(files, new Date(2026, 10, 6, 12, 30, 20));

    // the end record is the last 22 bytes
    const end = zip.length - 22;
    expect(zip.readUInt32LE(end)).toBe(0x06054b50);
    expect(zip.readUInt16LE(end + 10)).toBe(3); // entries
    let at = zip.readUInt32LE(end + 16); // start of the directory

    for (const f of files) {
      expect(zip.readUInt32LE(at)).toBe(0x02014b50);
      expect(zip.readUInt32LE(at + 16)).toBe(crc32(f.data) >>> 0);
      expect(zip.readUInt32LE(at + 24)).toBe(f.data.length);
      const nameLen = zip.readUInt16LE(at + 28);
      expect(zip.subarray(at + 46, at + 46 + nameLen).toString("utf8")).toBe(f.name);
      // the local header it points to holds the same name, and the bytes follow it
      const local = zip.readUInt32LE(at + 42);
      expect(zip.readUInt32LE(local)).toBe(0x04034b50);
      const start = local + 30 + nameLen;
      expect(zip.subarray(start, start + f.data.length).equals(f.data)).toBe(true);
      at += 46 + nameLen;
    }
  });

  it("can be empty", () => {
    const zip = makeZip([]);
    expect(zip.length).toBe(22);
  });
});
