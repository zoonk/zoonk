import { describe, expect, it } from "vitest";
import { evaluateExpression, evaluateFormula } from "./evaluate-expression";
import { parseExpression } from "./parse-expression";
import { sampleExpression } from "./sample-expression";

function valueOf(source: string, variables: Record<string, number> = {}): number | string {
  const result = evaluateFormula(source, variables);
  return result.ok ? result.value : result.error;
}

describe(parseExpression, () => {
  it("builds an AST and lists the variables it uses", () => {
    const parsed = parseExpression("speed^2 * sin(rad(2 * angle)) / g");

    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.expression.variables).toStrictEqual(["angle", "g", "speed"]);
  });

  it("keeps constants and function names out of the variables", () => {
    const parsed = parseExpression("2 * pi * r + e + max(a, b)");
    expect(parsed.ok && parsed.expression.variables).toStrictEqual(["a", "b", "r"]);
  });

  it.each([
    ["1 +", "The expression ends too early"],
    ["(1 + 2", 'Expected ")"'],
    ["2x", 'Unexpected "x"'],
    ["foo(1)", 'Unknown function "foo"'],
    ["sqrt", "is a function and needs parentheses"],
    ["round(1, 2, 3)", "can't take 3 arguments"],
    ["sqrt()", "can't take 0 arguments"],
    ["1 $ 2", 'Unexpected character "$"'],
    ["max(1 2)", 'Expected "," or ")"'],
  ])("rejects %s", (source, message) => {
    const parsed = parseExpression(source);

    expect(parsed.ok).toBe(false);
    expect(parsed.ok ? "" : parsed.error.message).toContain(message);
  });

  it("rejects code that isn't math, since nothing is ever run", () => {
    expect(parseExpression("constructor.constructor('alert(1)')()").ok).toBe(false);
    expect(parseExpression("process.exit()").ok).toBe(false);
    expect(parseExpression("x => x").ok).toBe(false);
    expect(parseExpression("a; b").ok).toBe(false);
  });

  it("rejects expressions that are too long or nested too deeply", () => {
    expect(parseExpression(`${"1+".repeat(200)}1`).ok).toBe(false);
    expect(parseExpression(`${"(".repeat(40)}1${")".repeat(40)}`).ok).toBe(false);
  });

  it("reports where the error is", () => {
    const parsed = parseExpression("1 + * 2");
    expect(parsed.ok ? null : parsed.error.position).toBe(4);
  });
});

describe(evaluateFormula, () => {
  it.each([
    ["1 + 2 * 3", 7],
    ["(1 + 2) * 3", 9],
    ["10 - 4 - 3", 3],
    ["2 ^ 3 ^ 2", 512],
    ["-2 ^ 2", -4],
    ["2 ^ -1", 0.5],
    ["-(3 - 5)", 2],
    ["+4", 4],
    ["8 / 4 / 2", 1],
    ["1.5e3 + .5", 1500.5],
  ])("follows precedence: %s = %d", (source, expected) => {
    expect(valueOf(source)).toBe(expected);
  });

  it("evaluates whitelisted functions and constants", () => {
    expect(valueOf("sqrt(16) + abs(-2) + min(4, 1, 9) + max(2, 5)")).toBe(12);
    expect(valueOf("round(2.345, 2)")).toBe(2.35);
    expect(valueOf("round(2.5)")).toBe(3);
    expect(valueOf("floor(2.7) + ceil(2.1)")).toBe(5);
    expect(valueOf("sin(rad(90)) + cos(0)")).toBeCloseTo(2);
    expect(valueOf("tan(pi / 4)")).toBeCloseTo(1);
    expect(valueOf("log(e) + ln(e) + log10(1000) + log2(8)")).toBeCloseTo(8);
    expect(valueOf("exp(0) + deg(pi)")).toBeCloseTo(181);
  });

  it("treats function names case-insensitively so spreadsheet formulas work", () => {
    expect(valueOf("ROUND(A1 * 0.15, 2)", { A1: 40 })).toBe(6);
  });

  it("uses the given variables", () => {
    expect(valueOf("1000 * (1 + rate / 100) ^ years", { rate: 7, years: 20 })).toBeCloseTo(
      3869.684,
    );
  });

  it("returns an error instead of throwing for values outside the domain", () => {
    expect(valueOf("1 / x", { x: 0 })).toBe(
      "Division by zero is not a finite number for these values",
    );

    expect(valueOf("sqrt(x)", { x: -1 })).toContain("sqrt(...)");
    expect(valueOf("log(0)")).toContain("log(...)");
    expect(valueOf("0 ^ -1")).toContain('"^"');
    expect(valueOf("round(1, 0.5)")).toContain("round(...)");
    expect(valueOf("x + 1")).toBe('Unknown variable "x"');
  });

  it("evaluates a parsed expression many times with different values", () => {
    const parsed = parseExpression("a * b");

    if (!parsed.ok) {
      throw new Error("expected the formula to parse");
    }

    expect(evaluateExpression(parsed.expression, { a: 2, b: 3 })).toStrictEqual({
      ok: true,
      value: 6,
    });

    expect(evaluateExpression(parsed.expression, { a: 4, b: 5 })).toStrictEqual({
      ok: true,
      value: 20,
    });
  });
});

describe(sampleExpression, () => {
  it("passes a formula that works across every slider position", () => {
    const result = sampleExpression({
      expression: "speed^2 * sin(rad(2 * angle)) / 9.81",
      ranges: [
        { max: 90, min: 0, name: "angle", step: 1 },
        { max: 30, min: 5, name: "speed", step: 1 },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.points).toBeGreaterThan(100);
  });

  it("finds the point where a formula breaks, including the range edges", () => {
    expect(
      sampleExpression({ expression: "100 / rate", ranges: [{ max: 10, min: 0, name: "rate" }] }),
    ).toStrictEqual({
      error: "Division by zero is not a finite number for these values",
      ok: false,
      point: { rate: 0 },
    });

    const inside = sampleExpression({
      expression: "1 / (x - 5)",
      ranges: [{ max: 10, min: 0, name: "x", step: 1 }],
    });

    expect(inside).toMatchObject({ ok: false, point: { x: 5 } });
  });

  it("reports parse errors and undeclared variables", () => {
    expect(sampleExpression({ expression: "2 +", ranges: [] })).toMatchObject({
      ok: false,
      point: null,
    });

    expect(
      sampleExpression({ expression: "x * y", ranges: [{ max: 1, min: 0, name: "x" }] }),
    ).toMatchObject({ error: 'Unknown variable "y"', ok: false });
  });
});
