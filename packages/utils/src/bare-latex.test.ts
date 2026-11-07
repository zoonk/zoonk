import { assert, constantFrom, property, string } from "fast-check";
import { describe, expect, it } from "vitest";
import { findBareLatex, wrapBareLatex } from "./bare-latex";

function problem(written: string, latex: string): string {
  return String.raw`Shows math as raw text: "${written}". Write it between dollar signs, as $${latex}$, outside bold or italics, and any other dollar sign in that line as \$.`;
}

describe(findBareLatex, () => {
  it("finds LaTeX a writer left outside math, with the math it should be", () => {
    expect(findBareLatex("A sensor log stores a tiny gap as 7.02 × 10^{-5} m.")).toStrictEqual([
      problem("10^{-5}", "10^{-5}"),
    ]);

    expect(findBareLatex("Calcule (6 × 10^3) ÷ (2 × 10^-1).")).toStrictEqual([
      problem("10^3", "10^{3}"),
      problem("10^-1", "10^{-1}"),
    ]);

    expect(findBareLatex(String.raw`Half of it is \frac{a + b}{2}, times x_{1}.`)).toStrictEqual([
      problem(String.raw`\frac{a + b}{2}`, String.raw`\frac{a + b}{2}`),
      problem("x_{1}", "x_{1}"),
    ]);
  });

  it("leaves math, code and text that only looks like it", () => {
    const texts = [
      String.raw`A sensor records $7.02 \times 10^{-5}$ m, or \(7.02 \times 10^{-5}\) m.`,
      String.raw`$$v = \sqrt{\frac{GM}{r}}$$`,
      "In Python, `2**10` and `x ^ y` aren't powers, and neither is `10^{3}`.",
      String.raw`It costs R$ 80, \$5 or $10, keeps user_id and the file C:\Users\ana\notes.txt.`,
      String.raw`Open C:\text\notes.txt to read it.`,
      "Smile ^_^ and rate it 9/10 * 2.",
    ];

    expect(texts.flatMap((text) => findBareLatex(text))).toStrictEqual([]);
  });
});

describe(wrapBareLatex, () => {
  it("wraps each piece of LaTeX in math, leaving the words around it as text", () => {
    expect(wrapBareLatex("A sensor log stores a tiny gap as 7.02 × 10^{-5} m.")).toBe(
      "A sensor log stores a tiny gap as 7.02 × $10^{-5}$ m.",
    );

    expect(wrapBareLatex("Calcule (6 × 10^3) ÷ (2 × 10^-1).")).toBe(
      "Calcule (6 × $10^{3}$) ÷ (2 × $10^{-1}$).",
    );

    expect(
      wrapBareLatex(String.raw`So $0.000406$ m = 4.06 \times 10^{-4} m, or \frac{a + b}{2}.`),
    ).toBe(String.raw`So $0.000406$ m = 4.06 $\times$ $10^{-4}$ m, or $\frac{a + b}{2}$.`);

    expect(wrapBareLatex(String.raw`The ratio is \frac{\sin(x)}{2}.`)).toBe(
      String.raw`The ratio is $\frac{\sin(x)}{2}$.`,
    );

    expect(wrapBareLatex("It's 10^{3}, then R$ 80 and $5 later.")).toBe(
      "It's $10^{3}$, then R$ 80 and $5 later.",
    );
  });

  it("keeps a power's whole exponent in the math and the signs around it out of it", () => {
    expect(wrapBareLatex("A gap is 7.02 × 10^−5 m.")).toBe("A gap is 7.02 × $10^{-5}$ m.");
    expect(wrapBareLatex("The increase is 10^2%.")).toBe("The increase is $10^{2}$%.");
    expect(wrapBareLatex("About ~10^3 cells.")).toBe("About ~$10^{3}$ cells.");
  });

  it("wraps LaTeX in table cells and on every line", () => {
    const text = [
      "Read the powers:",
      "",
      "| Power | Value |",
      "|---|---|",
      "| 10^{3} | 1000 |",
      "e^x grows.",
    ].join("\n");

    expect(wrapBareLatex(text)).toBe(
      [
        "Read the powers:",
        "",
        "| Power | Value |",
        "|---|---|",
        "| $10^{3}$ | 1000 |",
        "$e^{x}$ grows.",
      ].join("\n"),
    );
  });

  it("leaves a line the new math would break, for a writer to fix", () => {
    const texts = [
      "It costs $5 and the gap is 10^{-5} m.",
      "Learn **the 10^{3} rule** first.",
      "_e^x_ grows.",
      String.raw`The root is \sqrt 4 = 2.`,
      "O valor é 10^3,5.",
      "The point is (2^3,3^2).",
    ];

    expect(texts.map((text) => wrapBareLatex(text))).toStrictEqual(texts);
    expect(texts.map((text) => findBareLatex(text).length)).toStrictEqual([1, 1, 1, 1, 1, 1]);

    expect(findBareLatex(String.raw`The root is \sqrt 4 = 2.`)).toStrictEqual([
      String.raw`Shows math as raw text: "\sqrt". Write it between dollar signs, outside bold or italics, and any other dollar sign in that line as \$.`,
    ]);
  });

  it("keeps a table cell's escaped pipe inside its code", () => {
    const table = ["| Code | Meaning |", "|---|---|", String.raw`| \`a\|2^3\` | XOR |`].join("\n");

    expect(wrapBareLatex(table)).toBe(table);
    expect(findBareLatex(table)).toStrictEqual([]);
  });

  it("leaves no LaTeX outside math in any line it changes, and changes nothing the second time", () => {
    const pieces = constantFrom(
      "10^{-5}",
      "10^3",
      "x_{1}",
      String.raw`\times`,
      String.raw`\frac{1}{2}`,
      "$",
      String.raw`\$`,
      "`",
      "$x^2$",
      "R$ 80",
      String.raw`\sqrt`,
      String.raw`\notes`,
      "10^−5",
      "%",
      "~",
      ",",
      "|",
      "**",
      "_",
      "(",
      ")",
      "{",
      "}",
      "^",
      "5",
      "m",
      ".",
      " ",
    );

    assert(
      property(string({ maxLength: 12, unit: pieces }), (line) => {
        const wrapped = wrapBareLatex(line);

        expect(wrapped === line || findBareLatex(wrapped).length === 0).toBe(true);
        expect(wrapBareLatex(wrapped)).toBe(wrapped);
      }),
    );
  });
});
