import { isValidElement } from "react";
import { describe, expect, it } from "vitest";
import { breaksBetween, withBreakPoints, withWordBreakPoints } from "./code-breaks";

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

describe(withWordBreakPoints, () => {
  it("keeps a word short enough to fit on a line whole, so it moves to the next line as one", () => {
    expect(withWordBreakPoints("print(fruta)")).toStrictEqual(["print(fruta)"]);

    expect(withWordBreakPoints("for i in range(3):")).toStrictEqual([
      "for",
      " ",
      "i",
      " ",
      "in",
      " ",
      "range(3):",
    ]);
  });

  it("lets only a word too long for a line split, at its break points", () => {
    const nodes = withWordBreakPoints("x numeros.append(valor_muito_grande)");

    expect(nodes.slice(0, 2)).toStrictEqual(["x", " "]);
    expect(isValidElement(nodes[2])).toBe(true);
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
