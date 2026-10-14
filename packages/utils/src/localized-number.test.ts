import { describe, expect, it } from "vitest";
import {
  exactFractionDigitsFor,
  formatLocalizedNumber,
  fractionDigitsFor,
  parseLocalizedNumber,
} from "./localized-number";

describe(formatLocalizedNumber, () => {
  it("formats in the learner's language and rounds float noise for display", () => {
    expect(formatLocalizedNumber({ locale: "en", value: 3869.684462 })).toBe("3,869.68");
    expect(formatLocalizedNumber({ locale: "pt", value: 3869.684462 })).toBe("3.869,68");
  });

  it("signs changes, drops grouping for inputs and shortens axis labels", () => {
    expect(formatLocalizedNumber({ locale: "en", signed: true, value: 8 })).toBe("+8");
    expect(formatLocalizedNumber({ locale: "en", signed: true, value: 0 })).toBe("0");
    expect(formatLocalizedNumber({ grouping: false, locale: "en", value: 1960 })).toBe("1960");
    expect(formatLocalizedNumber({ compact: true, locale: "en", value: 1_200_000 })).toBe("1.2M");
  });
});

describe(fractionDigitsFor, () => {
  it("shows fewer decimals as numbers grow", () => {
    expect(fractionDigitsFor(3869.68)).toBe(0);
    expect(fractionDigitsFor(-130.52)).toBe(1);
    expect(fractionDigitsFor(5.25)).toBe(2);
    expect(fractionDigitsFor(0.125)).toBe(3);
  });

  it("keeps three significant digits for tiny values, so they never read as 0", () => {
    expect(fractionDigitsFor(0.000075)).toBe(7);

    expect(
      formatLocalizedNumber({
        locale: "en",
        maximumFractionDigits: fractionDigitsFor(0.000075),
        value: 0.000075,
      }),
    ).toBe("0.000075");

    expect(
      formatLocalizedNumber({
        locale: "pt",
        maximumFractionDigits: fractionDigitsFor(1e-10),
        value: 1e-10,
      }),
    ).toBe("0,0000000001");

    expect(fractionDigitsFor(0)).toBe(3);
  });
});

describe(exactFractionDigitsFor, () => {
  it.each([
    { expected: "0.1254", locale: "en" },
    { expected: "0,1254", locale: "pt" },
  ])("preserves the closer miss in $locale", ({ locale, expected }) => {
    expect(
      formatLocalizedNumber({
        locale,
        maximumFractionDigits: exactFractionDigitsFor({
          expected: 0.125,
          tolerance: { kind: "absolute", value: 0.0001 },
          value: 0.1254,
        }),
        value: 0.1254,
      }),
    ).toBe(expected);
  });

  it.each([
    { expected: 0.125, tolerance: { kind: "relative" as const, value: 0.0008 }, value: 0.1254 },
    { expected: 0, tolerance: { kind: "relative" as const, value: 0.01 }, value: 0.0004 },
    { expected: 52, tolerance: { kind: "absolute" as const, value: 0 }, value: 52.0004 },
    { expected: -0.125, tolerance: { kind: "absolute" as const, value: 0.0001 }, value: -0.1254 },
    { expected: 0.125, tolerance: { kind: "absolute" as const, value: 0.0001 }, value: 0.1246 },
  ])("distinguishes $value from $expected with $tolerance.kind tolerance", (input) => {
    const maximumFractionDigits = exactFractionDigitsFor(input);

    const format = (value: number) =>
      formatLocalizedNumber({ locale: "en", maximumFractionDigits, value });

    expect(format(input.value)).not.toBe(format(input.expected));
  });

  it("keeps the expected value precise before an answer and rounds accepted float noise", () => {
    const tolerance = { kind: "absolute" as const, value: 0.00001 };
    const expected = 0.12543;
    const maximumFractionDigits = exactFractionDigitsFor({ expected, tolerance });

    expect(formatLocalizedNumber({ locale: "en", maximumFractionDigits, value: expected })).toBe(
      "0.12543",
    );

    expect(
      formatLocalizedNumber({
        locale: "en",
        maximumFractionDigits: exactFractionDigitsFor({
          expected,
          tolerance,
          value: expected + Number.EPSILON,
        }),
        value: expected + Number.EPSILON,
      }),
    ).toBe("0.12543");
  });
});

describe(parseLocalizedNumber, () => {
  it("reads a decimal point or comma in any language", () => {
    expect(parseLocalizedNumber({ locale: "en", text: "3.5" })).toBe(3.5);
    expect(parseLocalizedNumber({ locale: "en", text: "3,5" })).toBe(3.5);
    expect(parseLocalizedNumber({ locale: "pt", text: "3,5" })).toBe(3.5);
    expect(parseLocalizedNumber({ locale: "pt", text: "0.25" })).toBe(0.25);
    expect(parseLocalizedNumber({ locale: "en", text: "3," })).toBe(3);
  });

  it("reads thousands grouped the locale's way", () => {
    expect(parseLocalizedNumber({ locale: "en", text: "1,000" })).toBe(1000);
    expect(parseLocalizedNumber({ locale: "pt", text: "1.000" })).toBe(1000);
    expect(parseLocalizedNumber({ locale: "en", text: "3,869.68" })).toBe(3869.68);
    expect(parseLocalizedNumber({ locale: "pt", text: "3.869,68" })).toBe(3869.68);
  });

  it("accepts signs, the typographic minus and spaces", () => {
    expect(parseLocalizedNumber({ locale: "en", text: " -3 " })).toBe(-3);
    expect(parseLocalizedNumber({ locale: "en", text: "\u22123" })).toBe(-3);
    expect(parseLocalizedNumber({ locale: "fr", text: "1\u202F000,5" })).toBe(1000.5);
  });

  it("rejects anything that isn't one plain number", () => {
    expect(parseLocalizedNumber({ locale: "en", text: "" })).toBeNull();
    expect(parseLocalizedNumber({ locale: "en", text: "3.5.1" })).toBeNull();
    expect(parseLocalizedNumber({ locale: "en", text: "12 kg" })).toBeNull();
    expect(parseLocalizedNumber({ locale: "en", text: "1e5" })).toBeNull();
  });
});
