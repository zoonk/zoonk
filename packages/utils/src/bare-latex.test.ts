import { assert, constantFrom, property, string } from "fast-check";
import { describe, expect, it } from "vitest";
import { findBareLatex, wrapBareLatex } from "./bare-latex";

function problem(written: string, latex?: string): string {
  const example = latex ? `, as $${latex}$` : "";
  return String.raw`Shows math as raw text: "${written}". Write it between dollar signs${example}, outside bold or italics, and any other dollar sign in that line as \$.`;
}

describe(findBareLatex, () => {
  it("finds powers and braced scripts a writer left outside math", () => {
    expect(findBareLatex("A sensor log stores a tiny gap as 7.02 × 10^{-5} m.")).toStrictEqual([
      problem("10^{-5}", "10^{-5}"),
    ]);

    expect(findBareLatex("Calcule (6 × 10^3) ÷ (2 × 10^-1).")).toStrictEqual([
      problem("10^3", "10^{3}"),
      problem("10^-1", "10^{-1}"),
    ]);

    expect(
      findBareLatex(String.raw`Then x^2 grows, Fe^3+ forms and \log_{10}(x) rises.`),
    ).toStrictEqual([problem("x^2"), problem("Fe^3+"), problem(String.raw`\log_{10}(x)`)]);
  });

  it("leaves math, code and text that only looks like it", () => {
    const texts = [
      String.raw`A sensor records $7.02 \times 10^{-5}$ m, or \(7.02 \times 10^{-5}\) m.`,
      String.raw`$$v = \sqrt{\frac{GM}{r}}$$`,
      "In Python, `2**10` and `x ^ y` aren't powers, and neither is `10^{3}`.",
      String.raw`It costs R$ 80, \$5 or $10, keeps user_id and the file C:\Users\ana\notes.txt.`,
      "Smile ^_^ and rate it 9/10 * 2.",
    ];

    expect(texts.flatMap((text) => findBareLatex(text))).toStrictEqual([]);
  });

  it("doesn't look for backslash commands or bare subscripts, which are as often paths, escapes or identifiers", () => {
    const texts = [
      String.raw`Open C:\log.txt or (logs\log.txt), read data\train.jsonl in src\utils.`,
      String.raw`In a regex, \S matches a non-space and \n starts a new line.`,
      "Set StandardCharsets.UTF_8, rename db_1, and note that methane is CH_4.",
    ];

    expect(texts.flatMap((text) => findBareLatex(text))).toStrictEqual([]);
    expect(texts.map((text) => wrapBareLatex(text))).toStrictEqual(texts);
  });
});

describe(wrapBareLatex, () => {
  it("wraps a number raised to a number in math, leaving the words around it as text", () => {
    expect(wrapBareLatex("A sensor log stores a tiny gap as 7.02 × 10^{-5} m.")).toBe(
      "A sensor log stores a tiny gap as 7.02 × $10^{-5}$ m.",
    );

    expect(wrapBareLatex("Calcule (6 × 10^3) ÷ (2 × 10^-1).")).toBe(
      "Calcule (6 × $10^{3}$) ÷ (2 × $10^{-1}$).",
    );

    expect(wrapBareLatex("So $0.000406$ m = 4.06 × 10^{-4} m, and it's 10^{3}, R$ 80 or $5.")).toBe(
      "So $0.000406$ m = 4.06 × $10^{-4}$ m, and it's $10^{3}$, R$ 80 or $5.",
    );

    expect(wrapBareLatex("Think of 10^3—it means one thousand.")).toBe(
      "Think of $10^{3}$—it means one thousand.",
    );

    expect(wrapBareLatex("A thousand (10^3) cells, or [10^{-2}].")).toBe(
      "A thousand ($10^{3}$) cells, or [$10^{-2}$].",
    );
  });

  it("keeps a power's whole exponent in the math and the signs around it out of it", () => {
    expect(wrapBareLatex("A gap is 7.02 × 10^−5 m.")).toBe("A gap is 7.02 × $10^{-5}$ m.");
    expect(wrapBareLatex("The increase is 10^2%.")).toBe("The increase is $10^{2}$%.");
    expect(wrapBareLatex("About ~10^3 cells.")).toBe("About ~$10^{3}$ cells.");
  });

  it("wraps powers in table cells and on every line", () => {
    const text = [
      "Read the powers:",
      "",
      "| Power | Value |",
      "|---|---|",
      "| 10^{3} | 1000 |",
      "2^10 is 1024.",
    ].join("\n");

    expect(wrapBareLatex(text)).toBe(
      [
        "Read the powers:",
        "",
        "| Power | Value |",
        "|---|---|",
        "| $10^{3}$ | 1000 |",
        "$2^{10}$ is 1024.",
      ].join("\n"),
    );
  });

  it("leaves anything but a plain numeric power to a writer, still flagged", () => {
    const texts = [
      "It costs $5 and the gap is 10^{-5} m.",
      "Learn **the 10^{3} rule** first.",
      "The area is **r**^2, or _r_^2.",
      "O valor é 10^3,5.",
      "The point is (2^3,3^2).",
      "The set is {2^3, 3^2}.",
      "A 10^3-fold increase over a 10^3-m race.",
      "Simplify x^2}+{y^2.",
      "Dissolved iron is Fe^3+(aq).",
      "The decay law is e^-(x+1), and x^-ab shrinks.",
      "The square is x'^2, the limit e^∞, the value 10^(−5).",
      String.raw`The volume is \frac{4\pi r^3}{3}.`,
    ];

    expect(texts.map((text) => wrapBareLatex(text))).toStrictEqual(texts);
    expect(texts.filter((text) => findBareLatex(text).length === 0)).toStrictEqual([]);
  });

  it("keeps a table cell's escaped pipe inside its code", () => {
    const table = ["| Code | Meaning |", "|---|---|", String.raw`| \`a\|2^3\` | XOR |`].join("\n");

    expect(wrapBareLatex(table)).toBe(table);
    expect(findBareLatex(table)).toStrictEqual([]);
  });

  it("leaves no raw power in any line it changes, and changes nothing the second time", () => {
    const pieces = constantFrom(
      "10^{-5}",
      "10^3",
      "10^−5",
      "x^2",
      "Fe^3+",
      "x_{1}",
      String.raw`\times`,
      "$",
      String.raw`\$`,
      "`",
      "$x^2$",
      "R$ 80",
      "%",
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
