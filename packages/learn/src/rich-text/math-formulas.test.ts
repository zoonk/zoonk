import { describe, expect, it } from "vitest";
import { collectFormulas } from "./math-formulas";

describe(collectFormulas, () => {
  it("finds the formulas a screen draws, never a dollar sign in its code", () => {
    const content = {
      options: [{ text: '```python\nprint("$y$")\n```' }],
      text: 'A área é $x^2$. Rode:\n```python\nprint("$x$")\n```\nE `"$z$"`?',
    };

    expect(collectFormulas(content).map(({ text }) => text)).toStrictEqual(["x^2", "x^2", "x^2"]);
  });

  it("finds no formulas on a screen with only code", () => {
    expect(collectFormulas('~~~python\nprint("$x$")\n~~~')).toStrictEqual([]);
  });
});
