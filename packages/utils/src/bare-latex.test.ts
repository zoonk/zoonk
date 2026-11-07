import { assert, constantFrom, property, string } from "fast-check";
import { describe, expect, it } from "vitest";
import { findBareLatex, wrapBareLatex } from "./bare-latex";

function find(text: string): string[] {
  return findBareLatex({ layout: "blocks", text });
}

function wrap(text: string): string {
  return wrapBareLatex({ layout: "blocks", text });
}

function problem(written: string, latex?: string): string {
  const example = latex ? `, as $${latex}$` : "";
  return String.raw`Shows math as raw text: "${written}". Write it between dollar signs${example}, outside bold or italics, and any other dollar sign in that line as \$.`;
}

describe(findBareLatex, () => {
  it("finds powers and braced scripts a writer left outside math", () => {
    expect(find("A sensor log stores a tiny gap as 7.02 × 10^{-5} m.")).toStrictEqual([
      problem("10^{-5}", "10^{-5}"),
    ]);

    expect(find("Calcule (6 × 10^3) ÷ (2 × 10^-1).")).toStrictEqual([
      problem("10^3", "10^{3}"),
      problem("10^-1", "10^{-1}"),
    ]);

    expect(find(String.raw`Then x^2 grows, Fe^3+ forms and \log_{10}(x) rises.`)).toStrictEqual([
      problem("x^2"),
      problem("Fe^3+"),
      problem(String.raw`\log_{10}(x)`),
    ]);
  });

  it("leaves math, code and text that only looks like it", () => {
    const texts = [
      String.raw`A sensor records $7.02 \times 10^{-5}$ m, or \(7.02 \times 10^{-5}\) m.`,
      String.raw`$$v = \sqrt{\frac{GM}{r}}$$`,
      "In Python, `2**10` and `x ^ y` aren't powers, and neither is `10^{3}`.",
      String.raw`It costs R$ 80, \$5 or $10, keeps user_id and the file C:\Users\ana\notes.txt.`,
      "Smile ^_^ and rate it 9/10 * 2.",
      'In regular expressions, ^ matches the start of a line; the caret (^) and "^" stay text.',
      "Na expressão regular, ^ marca o início da linha, e o ^ é chamado de acento circunflexo.",
      "In C, a ^ b is a bitwise XOR.",
    ];

    expect(texts.flatMap((text) => find(text))).toStrictEqual([]);
  });

  it("doesn't look for backslash commands or bare subscripts, which are as often paths, escapes or identifiers", () => {
    const texts = [
      String.raw`Open C:\log.txt or (logs\log.txt), read data\train.jsonl in src\utils.`,
      String.raw`In a regex, \S matches a non-space and \n starts a new line.`,
      "Set StandardCharsets.UTF_8, rename db_1, and note that methane is CH_4.",
    ];

    expect(texts.flatMap((text) => find(text))).toStrictEqual([]);
    expect(texts.map((text) => wrap(text))).toStrictEqual(texts);
  });
});

describe(wrapBareLatex, () => {
  it("wraps a number raised to a number in math, leaving the words around it as text", () => {
    expect(wrap("A sensor log stores a tiny gap as 7.02 × 10^{-5} m.")).toBe(
      "A sensor log stores a tiny gap as 7.02 × $10^{-5}$ m.",
    );

    expect(wrap("Calcule (6 × 10^3) ÷ (2 × 10^-1).")).toBe(
      "Calcule (6 × $10^{3}$) ÷ (2 × $10^{-1}$).",
    );

    expect(wrap("So $0.000406$ m = 4.06 × 10^{-4} m, and it's 10^{3}, R$ 80 or $5.")).toBe(
      "So $0.000406$ m = 4.06 × $10^{-4}$ m, and it's $10^{3}$, R$ 80 or $5.",
    );

    expect(wrap("Think of 10^3—it means one thousand.")).toBe(
      "Think of $10^{3}$—it means one thousand.",
    );

    expect(wrap("A thousand (10^3) cells, or [10^{-2}].")).toBe(
      "A thousand ($10^{3}$) cells, or [$10^{-2}$].",
    );
  });

  it("keeps a power's whole exponent in the math and the signs around it out of it", () => {
    expect(wrap("A gap is 7.02 × 10^−5 m.")).toBe("A gap is 7.02 × $10^{-5}$ m.");
    expect(wrap("The increase is 10^2%.")).toBe("The increase is $10^{2}$%.");
    expect(wrap("About ~10^3 cells.")).toBe("About ~$10^{3}$ cells.");
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

    expect(wrap(text)).toBe(
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
      "Complete 10^? = 1000, where the equilibrium price is p^*.",
      "A square has area x ^ 2, or x^ 2, and 10 ^ -5 is small.",
      "The area is (a + b) ^ 2, the gap 10 ^ {−5} m.",
      "Complete |x|^? = 16 when |x| = 2.",
    ];

    expect(texts.map((text) => wrap(text))).toStrictEqual(texts);
    expect(texts.filter((text) => find(text).length === 0)).toStrictEqual([]);
  });

  it("reads an inline field as one line, as the player shows it", () => {
    const priced = "A $5 kit\nwith 10^3 cells.";
    const bold = "Use **the 10^3\nrule**.";

    expect(wrapBareLatex({ layout: "inline", text: priced })).toBe(priced);
    expect(wrapBareLatex({ layout: "inline", text: bold })).toBe(bold);

    expect(findBareLatex({ layout: "inline", text: priced })).toStrictEqual([
      problem("10^3", "10^{3}"),
    ]);

    expect(wrap(priced)).toBe("A $5 kit\nwith $10^{3}$ cells.");

    const realPrice = "A $5 kit (R$ \n25) has 10^3 cells.";

    expect(wrapBareLatex({ layout: "inline", text: realPrice })).toBe(realPrice);

    expect(wrapBareLatex({ layout: "inline", text: "The gap is\n  10^{-5} m." })).toBe(
      "The gap is $10^{-5}$ m.",
    );
  });

  it("keeps a table cell's escaped pipe inside its code", () => {
    const table = ["| Code | Meaning |", "|---|---|", String.raw`| \`a\|2^3\` | XOR |`].join("\n");

    expect(wrap(table)).toBe(table);
    expect(find(table)).toStrictEqual([]);
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
        const wrapped = wrap(line);

        expect(wrapped === line || find(wrapped).length === 0).toBe(true);
        expect(wrap(wrapped)).toBe(wrapped);
      }),
    );
  });
});
