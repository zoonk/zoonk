import { describe, expect, it } from "vitest";
import { formatLocalizedNumber, fractionDigitsFor, parseLocalizedNumber } from "./localized-number";

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
