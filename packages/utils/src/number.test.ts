import { describe, expect, it } from "vitest";
import {
  type LocalizedNumberFormatter,
  formatGoalProgress,
  formatMetricPercent,
  formatWholeNumber,
  validateOffset,
} from "./number";

function createFormatter(locale: string): LocalizedNumberFormatter {
  return { number: (value, options) => new Intl.NumberFormat(locale, options).format(value) };
}

describe(validateOffset, () => {
  it("parses valid positive integer", () => {
    expect(validateOffset("3")).toBe(3);
  });

  it("floors decimal values", () => {
    expect(validateOffset("3.7")).toBe(3);
  });

  it("returns 0 for undefined", () => {
    expect(validateOffset()).toBe(0);
  });

  it("returns 0 for NaN", () => {
    expect(validateOffset("abc")).toBe(0);
  });

  it("returns 0 for Infinity", () => {
    expect(validateOffset("Infinity")).toBe(0);
  });

  it("returns 0 for negative values", () => {
    expect(validateOffset("-5")).toBe(0);
  });

  it("returns 0 for negative decimals", () => {
    expect(validateOffset("-0.5")).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(validateOffset("")).toBe(0);
  });
});

describe(formatWholeNumber, () => {
  it("formats grouped counts with the provided formatter", () => {
    expect(formatWholeNumber({ format: createFormatter("en-US"), value: 1234 })).toBe("1,234");
  });
});

describe(formatMetricPercent, () => {
  it("formats 0-100 metric values as localized percentages", () => {
    expect(formatMetricPercent({ format: createFormatter("en-US"), value: 88 })).toBe("88%");
  });

  it("keeps one decimal only when needed", () => {
    expect(formatMetricPercent({ format: createFormatter("en-US"), value: 88.5153768537537 })).toBe(
      "88.5%",
    );
  });
});

describe(formatGoalProgress, () => {
  it("shows a long plan's first lessons instead of 0%", () => {
    expect(formatGoalProgress({ format: createFormatter("en-US"), share: 6 / 3738 })).toBe("0.16%");
    expect(formatGoalProgress({ format: createFormatter("pt-BR"), share: 6 / 3738 })).toBe("0,16%");
  });

  it("drops trailing zeros at whole percentages", () => {
    expect(formatGoalProgress({ format: createFormatter("en-US"), share: 0 })).toBe("0%");
    expect(formatGoalProgress({ format: createFormatter("en-US"), share: 0.25 })).toBe("25%");
    expect(formatGoalProgress({ format: createFormatter("en-US"), share: 1 })).toBe("100%");
  });
});
