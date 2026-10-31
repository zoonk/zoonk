import { describe, expect, it } from "vitest";
import { mathMarkupKey } from "./math-key";
import { collectMathMarkup, renderMathMarkup } from "./math-markup";
import { parseRichBlocks, parseRichInline, toOneLine } from "./rich-text-parser";

function shownFormulas(text: string) {
  return parseRichInline(text).flatMap((segment) =>
    segment.kind === "math" || segment.kind === "displayMath"
      ? [{ displayMode: segment.kind === "displayMath", text: segment.text }]
      : [],
  );
}

describe(collectMathMarkup, () => {
  it("draws every formula a screen shows, as the browser would", () => {
    const text = String.raw`Compare $x^2$ with $$\frac{a}{b}$$, \(y_1\) and \[\sqrt{z}\].`;
    const markup = collectMathMarkup({ steps: [{ content: { question: text } }] });
    const formulas = shownFormulas(text);

    expect(formulas).toHaveLength(4);

    for (const formula of formulas) {
      expect(markup[mathMarkupKey(formula)]).toBe(renderMathMarkup(formula));
    }
  });

  it("draws a formula in text the player reflows onto one line exactly as the player draws it", () => {
    const text = "The speed is $$v =\n  \\sqrt{\\frac{GM}{r}}$$ in orbit.";
    const markup = collectMathMarkup([text]);
    const [formula] = shownFormulas(toOneLine(text));

    expect(formula).toBeDefined();
    expect(markup[mathMarkupKey(formula!)]).toBe(renderMathMarkup(formula!));
  });

  it("keeps formulas that differ only in spaces apart", () => {
    const tight = String.raw`$\verb|a b|$`;
    const wide = String.raw`$\verb|a  b|$`;
    const markup = collectMathMarkup({ options: [tight, wide] });
    const [first] = shownFormulas(tight);
    const [second] = shownFormulas(wide);

    expect(markup[mathMarkupKey(first!)]).toBe(renderMathMarkup(first!));
    expect(markup[mathMarkupKey(second!)]).toBe(renderMathMarkup(second!));
    expect(markup[mathMarkupKey(first!)]).not.toBe(markup[mathMarkupKey(second!)]);
  });

  it("finds formulas in a table's cells and a list's items", () => {
    const text = "| Sensor | Formula |\n| --- | --- |\n| A | $x^2$ |\n\n- First $a+b$\n- Second";
    const markup = collectMathMarkup({ text });

    const [table, list] = parseRichBlocks(text);
    const cells = table?.kind === "table" ? table.rows.flatMap((row) => row.flat()) : [];
    const items = list?.kind === "list" ? list.items.flat() : [];

    const formulas = [...cells, ...items].flatMap((segment) =>
      segment.kind === "math" ? [{ displayMode: false, text: segment.text }] : [],
    );

    expect(formulas.map((formula) => formula.text)).toStrictEqual(["x^2", "a+b"]);

    for (const formula of formulas) {
      expect(markup[mathMarkupKey(formula)]).toBe(renderMathMarkup(formula));
    }
  });

  it("draws a formula field's LaTeX on its own line", () => {
    const markup = collectMathMarkup({ lines: [{ label: "Area", math: "A = \\pi r^2" }] });
    const formula = { displayMode: true, text: "A = \\pi r^2" };

    expect(markup[mathMarkupKey(formula)]).toBe(renderMathMarkup(formula));
  });

  it("leaves prices and plain text out", () => {
    expect(
      collectMathMarkup({ question: "It costs $5 and then $10.", title: "Saving" }),
    ).toStrictEqual({});
  });
});
