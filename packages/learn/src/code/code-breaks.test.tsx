import { describe, expect, it } from "vitest";
import { breaksBetween, withBreakPoints } from "./code-breaks";

function pieces(text: string): string[] {
  return withBreakPoints(text).filter((node): node is string => typeof node === "string");
}

describe(withBreakPoints, () => {
  it("lets a line split before a dot and after an opening bracket or a comma", () => {
    expect(pieces("Promise.resolve('ok').then(log, 2);")).toStrictEqual([
      "Promise",
      ".resolve(",
      "'ok')",
      ".then(",
      "log,",
      " 2);",
    ]);
  });

  it("keeps an empty pair and a leading dot whole", () => {
    expect(pieces(".then()")).toStrictEqual([".then()"]);
    expect(pieces("items[]")).toStrictEqual(["items[]"]);
  });
});

describe(breaksBetween, () => {
  it("splits where a run after an opening bracket or before a dot starts", () => {
    expect(breaksBetween(".reject(", "'offline'")).toBe(true);
    expect(breaksBetween("Promise", ".reject(")).toBe(true);
    expect(breaksBetween("print(", ")")).toBe(false);
    expect(breaksBetween("", ".then")).toBe(false);
    expect(breaksBetween("return", " await")).toBe(false);
  });
});
