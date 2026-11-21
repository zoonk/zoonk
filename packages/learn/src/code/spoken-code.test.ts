import { describe, expect, it } from "vitest";
import { readCodeLine } from "./spoken-code";

describe(readCodeLine, () => {
  it("reads a line's indentation apart from its code", () => {
    expect(readCodeLine("    print(fruta)")).toStrictEqual({
      code: "print(fruta)",
      indent: [{ count: 4, kind: "space" }],
    });

    expect(readCodeLine("for fruta in frutas:")).toStrictEqual({
      code: "for fruta in frutas:",
      indent: [],
    });
  });

  it("keeps tabs and spaces apart, in the order written", () => {
    expect(readCodeLine("\t\t  return n").indent).toStrictEqual([
      { count: 2, kind: "tab" },
      { count: 2, kind: "space" },
    ]);
  });

  it("reads a line of only spaces as blank", () => {
    expect(readCodeLine("   ")).toStrictEqual({ code: "", indent: [] });
  });
});
