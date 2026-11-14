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
  return String.raw`Shows raw text that reads as math: "${written}". If it's math, write it between dollar signs${example}, outside bold or italics, and any other dollar sign in that line as \$. If it's code, a file name or a link, put it in backticks.`;
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

  it("finds one letter with a bare subscript, and nothing it can wrap for the writer", () => {
    const text = "At the inlet, C_A0 rises, (E_a) falls, F_Y(y) grows, x_1 is set and C_out drops.";

    expect(find(text)).toStrictEqual([
      problem("C_A0"),
      problem("E_a"),
      problem("F_Y(y)"),
      problem("x_1"),
      problem("C_out"),
    ]);

    expect(wrap(text)).toBe(text);
  });

  it("finds a one-letter subscript written against operators, brackets or punctuation", () => {
    const text = "Use C_A0=2, then E_a/RT, 1/x_1, x_1+x_2, 2x_1 and (k_B·T).";

    expect(find(text)).toStrictEqual([
      problem("C_A0=2"),
      problem("E_a/RT"),
      problem("1/x_1"),
      problem("x_1+x_2"),
      problem("2x_1"),
      problem("k_B·T"),
    ]);

    expect(findBareLatex({ layout: "inline", text: "C_A0 = 2" })).toStrictEqual([problem("C_A0")]);

    expect(wrap(text)).toBe(text);
  });

  it("finds a one-letter subscript written against a coefficient, a difference or a short product", () => {
    const text =
      "Then kC_A², V = QX/[kC_A0(1 − X)], pK_a, kT_e, αC_A, ΔH_f, ΔG_rxn, Δx_1, δq_rev, RT_m and nRT_m.";

    expect(find(text)).toStrictEqual([
      problem("kC_A²"),
      problem("QX/[kC_A0(1"),
      problem("pK_a"),
      problem("kT_e"),
      problem("αC_A"),
      problem("ΔH_f"),
      problem("ΔG_rxn"),
      problem("Δx_1"),
      problem("δq_rev"),
      problem("RT_m"),
      problem("nRT_m"),
    ]);

    expect(wrap(text)).toBe(text);
  });

  it("leaves italics, names, code and math that hold an underscore", () => {
    const texts = [
      "Read _carefully_ and _a_ word, then _the whole phrase_.",
      "Store it in user_id or max_value, and call `x_1 = load()`.",
      String.raw`The rate is $k = A e^{-E_a/RT}$ and $C_{A0}$ is given.`,
      "Set user_id=max_value+1 and keep CH_4/UTF_8 in db_1.",
      "Call __init__ in snake_case, then read API_key, HTTP_proxy, PATH_info and SEEK_SET.",
      "Rename myVar_1, parseJSON_data, iOS_version and macOS_14, and call `kC_A = 1`.",
    ];

    expect(texts.flatMap((text) => find(text))).toStrictEqual([]);
    expect(texts.flatMap((text) => findBareLatex({ layout: "inline", text }))).toStrictEqual([]);
  });

  it("asks for backticks around code, a file name or a link that reads as math", () => {
    expect(find("Read x^2.y, 10^3.m and data/x_1.")).toStrictEqual([
      problem("x^2.y"),
      problem("10^3.m"),
      problem("data/x_1"),
    ]);

    expect(find("Read `x^2.y`, `10^3.m` and `data/x_1`.")).toStrictEqual([]);
  });

  it("doesn't look for backslash commands, longer subscripted names or spaced carets, which are as often something else", () => {
    const texts = [
      String.raw`Open C:\log.txt or (logs\log.txt), read data\train.jsonl in src\utils.`,
      String.raw`In a regex, \S matches a non-space and \n starts a new line.`,
      "Set StandardCharsets.UTF_8, rename db_1, and note that methane is CH_4.",
      "A caret with spaces is as often named in prose: x ^ 2, (a + b) ^ 2, O ^ (acento) and $r$^2.",
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

    expect(wrap("It costs $5 and the gap is 10^{-5} m.")).toBe(
      "It costs $5 and the gap is $10^{-5}$ m.",
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
      "Complete |x|^? = 16 when |x| = 2.",
    ];

    expect(texts.map((text) => wrap(text))).toStrictEqual(texts);
    expect(texts.filter((text) => find(text).length === 0)).toStrictEqual([]);
  });

  it("reads an inline field as one line, as the player shows it", () => {
    const priced = "A $5 kit\nwith 10^3 cells.";
    const bold = "Use **the 10^3\nrule**.";

    expect(wrapBareLatex({ layout: "inline", text: priced })).toBe("A $5 kit with $10^{3}$ cells.");
    expect(wrapBareLatex({ layout: "inline", text: bold })).toBe(bold);

    expect(findBareLatex({ layout: "inline", text: priced })).toStrictEqual([
      problem("10^3", "10^{3}"),
    ]);

    expect(wrap(priced)).toBe("A $5 kit\nwith $10^{3}$ cells.");

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
