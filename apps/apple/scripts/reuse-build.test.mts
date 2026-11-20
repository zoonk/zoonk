import { describe, expect, it } from "vitest";
import { contentTime, parseStagedFiles } from "./reuse-build.mts";

describe("times that let Xcode reuse a restored build", () => {
  it("the same content keeps its time and changed content gets another", () => {
    const before = contentTime("c1a76ee0005f99898002c84e7b53af517a9be193");

    expect(contentTime("c1a76ee0005f99898002c84e7b53af517a9be193")).toBe(before);
    expect(contentTime("c1a76ef0005f99898002c84e7b53af517a9be193")).not.toBe(before);
  });

  it("every time is a whole second before any build", () => {
    const latest = contentTime("ffffffffffffffffffffffffffffffffffffffff");

    expect(Number.isInteger(latest)).toBe(true);
    expect(latest).toBeLessThan(Date.now() / 1000);
    expect(contentTime("0000000000000000000000000000000000000000")).toBeLessThan(latest);
  });

  it("reads each file's content hash, keeping spaces and tabs in its path", () => {
    const staged =
      "100644 c1a76ee0005f99898002c84e7b53af517a9be193 0\tZoonk/App/ZoonkApp.swift\0" +
      "100755 0b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4 0\tZoonk/Resources/App Icon.png\0" +
      "100644 5f60718293a4b5c6d7e8f9a0b1c2d3e40b2c3d4e 0\tZoonk/Chart\tNotes.md\0";

    expect(parseStagedFiles(staged)).toStrictEqual([
      { file: "Zoonk/App/ZoonkApp.swift", hash: "c1a76ee0005f99898002c84e7b53af517a9be193" },
      { file: "Zoonk/Resources/App Icon.png", hash: "0b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4" },
      { file: "Zoonk/Chart\tNotes.md", hash: "5f60718293a4b5c6d7e8f9a0b1c2d3e40b2c3d4e" },
    ]);
  });
});
