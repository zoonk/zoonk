import { describe, expect, it } from "vitest";
import { withBreakPoints } from "./code-breaks";

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
