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

    expect(findBareLatex(String.raw`Then \log_{10}(x) grows.`)).toStrictEqual([
      String.raw`Shows math as raw text: "\log_{10}(x)". Write it between dollar signs, outside bold or italics, and any other dollar sign in that line as \$.`,
    ]);
  });

  it("leaves math, code, paths, escapes and identifiers alone", () => {
    const texts = [
      String.raw`A sensor records $7.02 \times 10^{-5}$ m, or \(7.02 \times 10^{-5}\) m.`,
      String.raw`$$v = \sqrt{\frac{GM}{r}}$$`,
      "In Python, `2**10` and `x ^ y` aren't powers, and neither is `10^{3}`.",
      String.raw`It costs R$ 80, \$5 or $10, keeps user_id and the file C:\Users\ana\notes.txt.`,
      String.raw`Open C:\text\notes.txt, C:\log.txt or (logs\log.txt), and read data\train.jsonl in src\utils.`,
      "Set user_1, max_2 and StandardCharsets.UTF_8, then rename db_1 to db_2.",
      "Abra /tmp/ch_1.txt e docs/x_1.md para ler os arquivos.",
      String.raw`In a regex, \S matches a non-space and \n starts a new line; see \url{https://example.com}.`,
      "Smile ^_^ and rate it 9/10 * 2.",
    ];

    expect(texts.flatMap((text) => findBareLatex(text))).toStrictEqual([]);
    expect(texts.map((text) => wrapBareLatex(text))).toStrictEqual(texts);
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

    expect(wrapBareLatex("So $0.000406$ m = 4.06 × 10^{-4} m, and it's 10^{3}, R$ 80 or $5.")).toBe(
      "So $0.000406$ m = 4.06 × $10^{-4}$ m, and it's $10^{3}$, R$ 80 or $5.",
    );

    expect(wrapBareLatex("It factors as x^2-xy, then x^2–y_1, with log_{10}(1000).")).toBe(
      "It factors as $x^{2}-xy$, then $x^{2}–y_{1}$, with $log_{10}(1000)$.",
    );

    expect(wrapBareLatex("The pressure is 10^3kPa; e^-x decays, and the x^2's sign flips.")).toBe(
      "The pressure is $10^{3}kPa$; $e^{-x}$ decays, and the $x^{2}$'s sign flips.",
    );

    expect(wrapBareLatex("Ions: Na^+, Cl^- and Fe^3+ at 10^+3 Pa.")).toBe(
      "Ions: $Na^{+}$, $Cl^{-}$ and $Fe^{3+}$ at $10^{+3}$ Pa.",
    );

    expect(wrapBareLatex("Think of 10^3—it means one thousand. Recall—x^2 grows.")).toBe(
      "Think of $10^{3}$—it means one thousand. Recall—$x^{2}$ grows.",
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
      "O valor é 10^3,5.",
      "The point is (2^3,3^2).",
      "A 10^3-fold increase.",
      "A 10^3‑fold increase.",
      "The area is **r**^2.",
      "Then x^-ab shrinks.",
      "Simplify x^2}+{y^2.",
      "The set {10^3 is open.",
      String.raw`The volume is \frac{4\pi r^3}{3}.`,
      String.raw`Then \log_{10}(x) grows.`,
    ];

    expect(texts.map((text) => wrapBareLatex(text))).toStrictEqual(texts);
    expect(texts.map((text) => findBareLatex(text).length)).toStrictEqual(texts.map(() => 1));
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
      "10^−5",
      "Fe^3+",
      "%",
      "~",
      ",",
      "|",
      "**",
      "_",
      "—",
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
