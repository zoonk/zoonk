import { describe, expect, it } from "vitest";
import { findMathSpans } from "./math-spans";

function formulas(text: string): string[] {
  return findMathSpans(text).map(({ content }) => content);
}

describe(findMathSpans, () => {
  it("keeps a price before a formula as text instead of swallowing it into the formula", () => {
    expect(formulas("It costs $5 and the gap is $10^{-5}$ m")).toStrictEqual(["10^{-5}"]);
  });

  it("keeps prices around bold as text", () => {
    expect(formulas("It costs $5 or **about $10** now.")).toStrictEqual([]);
    expect(formulas("It costs $5 and $10, or R$ 80.")).toStrictEqual([]);
  });

  it("ends a formula at its first unescaped dollar, never past a currency sign", () => {
    expect(formulas("Add $x + US$5$ here")).toStrictEqual([]);
    expect(formulas(String.raw`Pay $\$5 + x$ now`)).toStrictEqual([String.raw`\$5 + x`]);
  });

  it("reads a number the writer put between dollars as math", () => {
    expect(formulas("The value $5$ is odd, but $x$5 is not math")).toStrictEqual(["5"]);
  });

  it("leaves an empty display pair as text without its closer opening another formula", () => {
    expect(formulas("$$ $$ is empty, but $$x$$ is not")).toStrictEqual(["x"]);
  });

  it("never reads a dollar or bracket inside inline code as a math delimiter", () => {
    expect(formulas("Match `^a$|^b$`, then $x$.")).toStrictEqual(["x"]);
    expect(formulas("Print `echo $HOME` and `\\(x\\)` as written.")).toStrictEqual([]);
  });

  it("keeps a backtick inside a formula that opens before it", () => {
    expect(formulas("$\\text{`x`}$ and $y$")).toStrictEqual(["\\text{`x`}", "y"]);
    expect(formulas("\\(a `b` c\\) then `$d$`")).toStrictEqual(["a `b` c"]);
  });
});
