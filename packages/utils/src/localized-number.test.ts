import {
  assert,
  boolean,
  constant,
  constantFrom,
  double,
  integer,
  oneof,
  pre,
  property,
  record,
  tuple,
} from "fast-check";
import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "./locale";
import {
  exactFractionDigitsFor,
  formatLocalizedNumber,
  fractionDigitsFor,
  parseLocalizedNumber,
} from "./localized-number";

const locales = constantFrom(...SUPPORTED_LOCALES);
const decimals = integer({ max: 10, min: 0 });

const digits = oneof(
  integer({ max: 9999, min: -9999 }),
  integer({ max: 999_999_999, min: -999_999_999 }),
);

const typedNumber = tuple(digits, decimals).map(([whole, places]) => whole / 10 ** places);

describe(formatLocalizedNumber, () => {
  it("formats in the learner's language and rounds float noise for display", () => {
    expect(formatLocalizedNumber({ locale: "en", value: 3869.684462 })).toBe("3,869.68");
    expect(formatLocalizedNumber({ locale: "pt", value: 3869.684462 })).toBe("3.869,68");
  });

  it("writes Spanish the Mexican way, not Spain's", () => {
    expect(formatLocalizedNumber({ locale: "es", value: 3869.684462 })).toBe("3,869.68");
  });

  it("signs changes, drops grouping for inputs and shortens axis labels", () => {
    expect(formatLocalizedNumber({ locale: "en", signed: true, value: 8 })).toBe("+8");
    expect(formatLocalizedNumber({ locale: "en", signed: true, value: 0 })).toBe("0");
    expect(formatLocalizedNumber({ grouping: false, locale: "en", value: 1960 })).toBe("1960");
    expect(formatLocalizedNumber({ compact: true, locale: "en", value: 1_200_000 })).toBe("1.2M");
  });

  it("writes a number that reads as zero without a minus sign", () => {
    expect(formatLocalizedNumber({ locale: "en", value: -0 })).toBe("0");
    expect(formatLocalizedNumber({ locale: "en", value: -0.0001 })).toBe("0");
    expect(formatLocalizedNumber({ compact: true, locale: "en", value: -0 })).toBe("0");
    expect(formatLocalizedNumber({ locale: "en", value: -0.5 })).toBe("−0.5");
  });

  it("writes a ratio as a percent the learner's language's way", () => {
    const percent = { maximumFractionDigits: 1, percent: true };

    expect(formatLocalizedNumber({ ...percent, locale: "en", value: 0.305 })).toBe("30.5%");
    expect(formatLocalizedNumber({ ...percent, locale: "tr", value: 0.3 })).toBe("%30");
    expect(formatLocalizedNumber({ ...percent, locale: "en", value: -0.05 })).toBe("−5%");
    expect(formatLocalizedNumber({ ...percent, locale: "en", value: -0.0004 })).toBe("0%");
  });

  it("shows a minus sign exactly when the number it writes reads as negative", () => {
    assert(
      property(
        locales,
        double({ noDefaultInfinity: true, noNaN: true }),
        decimals,
        (locale, value, maximumFractionDigits) => {
          const text = formatLocalizedNumber({ locale, maximumFractionDigits, value });
          const shown = parseLocalizedNumber({ locale, text }) ?? Number.NaN;

          expect(text.startsWith("−")).toBe(shown < 0);
        },
      ),
    );
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

  it("never shows a wrong typed answer the same as the expected one", () => {
    const closeAnswers = tuple(digits, integer({ max: 1000, min: -1000 }), decimals).map(
      ([whole, miss, places]) => ({
        expected: whole / 10 ** places,
        value: (whole + miss) / 10 ** places,
      }),
    );

    const tolerances = oneof(
      record({ kind: constant("absolute" as const), value: double({ max: 10, min: 0 }) }),
      record({ kind: constant("relative" as const), value: double({ max: 0.1, min: 0 }) }),
    );

    assert(
      property(
        oneof(closeAnswers, record({ expected: typedNumber, value: typedNumber })),
        tolerances,
        ({ expected, value }, tolerance) => {
          const allowed =
            tolerance.kind === "absolute" ? tolerance.value : tolerance.value * Math.abs(expected);

          pre(Math.abs(value - expected) > allowed);

          const maximumFractionDigits = exactFractionDigitsFor({ expected, tolerance, value });

          const format = (number: number) =>
            formatLocalizedNumber({ locale: "en", maximumFractionDigits, value: number });

          expect(format(value)).not.toBe(format(expected));
        },
      ),
    );
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
  it("reads back every number written in any language as the number it shows", () => {
    assert(
      property(
        locales,
        typedNumber,
        decimals,
        boolean(),
        boolean(),
        (locale, value, maximumFractionDigits, grouping, signed) => {
          const text = formatLocalizedNumber({
            grouping,
            locale,
            maximumFractionDigits,
            signed,
            value,
          });

          const plain = formatLocalizedNumber({
            grouping: false,
            locale: "en",
            maximumFractionDigits,
            value,
          });

          expect(parseLocalizedNumber({ locale, text })).toBe(Number(plain.replace("−", "-")));
        },
      ),
    );
  });

  it("reads a decimal point or comma in any language", () => {
    expect(parseLocalizedNumber({ locale: "en", text: "3.5" })).toBe(3.5);
    expect(parseLocalizedNumber({ locale: "en", text: "3,5" })).toBe(3.5);
    expect(parseLocalizedNumber({ locale: "pt", text: "3,5" })).toBe(3.5);
    expect(parseLocalizedNumber({ locale: "pt", text: "12,5" })).toBe(12.5);
    expect(parseLocalizedNumber({ locale: "de", text: "2,5" })).toBe(2.5);
    expect(parseLocalizedNumber({ locale: "pt", text: "0.25" })).toBe(0.25);
    expect(parseLocalizedNumber({ locale: "en", text: "3," })).toBe(3);
  });

  it("reads thousands grouped the locale's way", () => {
    expect(parseLocalizedNumber({ locale: "en", text: "1,000" })).toBe(1000);
    expect(parseLocalizedNumber({ locale: "en", text: "12,000" })).toBe(12_000);
    expect(parseLocalizedNumber({ locale: "en", text: "1,234,567" })).toBe(1_234_567);
    expect(parseLocalizedNumber({ locale: "pt", text: "1.000" })).toBe(1000);
    expect(parseLocalizedNumber({ locale: "pt", text: "12.000" })).toBe(12_000);
    expect(parseLocalizedNumber({ locale: "en", text: "3,869.68" })).toBe(3869.68);
    expect(parseLocalizedNumber({ locale: "pt", text: "3.869,68" })).toBe(3869.68);
    expect(parseLocalizedNumber({ locale: "es", text: "1,000" })).toBe(1000);
  });

  it("takes the last mark as the decimal point when both appear, in any language", () => {
    expect(parseLocalizedNumber({ locale: "en", text: "1.234,5" })).toBe(1234.5);
    expect(parseLocalizedNumber({ locale: "pt", text: "1,234.5" })).toBe(1234.5);
    expect(parseLocalizedNumber({ locale: "de", text: "1.234,5" })).toBe(1234.5);
    expect(parseLocalizedNumber({ locale: "de", text: "1,234.5" })).toBe(1234.5);
  });

  it("never reads a number starting with 0 as grouped", () => {
    expect(parseLocalizedNumber({ locale: "en", text: "0,125" })).toBe(0.125);
    expect(parseLocalizedNumber({ locale: "en", text: "-0,125" })).toBe(-0.125);
    expect(parseLocalizedNumber({ locale: "pt", text: "0.125" })).toBe(0.125);
    expect(parseLocalizedNumber({ locale: "de", text: "0,125" })).toBe(0.125);
  });

  it("accepts signs, the typographic minus and spaces", () => {
    expect(parseLocalizedNumber({ locale: "en", text: " -3 " })).toBe(-3);
    expect(parseLocalizedNumber({ locale: "en", text: "\u22123" })).toBe(-3);
    expect(parseLocalizedNumber({ locale: "fr", text: "1\u202F000,5" })).toBe(1000.5);
  });

  it("rejects anything that isn't one plain number", () => {
    expect(parseLocalizedNumber({ locale: "en", text: "" })).toBeNull();
    expect(parseLocalizedNumber({ locale: "en", text: "3.5.1" })).toBeNull();
    expect(parseLocalizedNumber({ locale: "en", text: "1.234,5,6" })).toBeNull();
    expect(parseLocalizedNumber({ locale: "en", text: "12 kg" })).toBeNull();
    expect(parseLocalizedNumber({ locale: "en", text: "1e5" })).toBeNull();
  });
});
