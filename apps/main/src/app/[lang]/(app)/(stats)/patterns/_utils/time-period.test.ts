import { describe, expect, it } from "vitest";
import { getScoreTimePeriodRange } from "./time-period";

describe(getScoreTimePeriodRange, () => {
  it("says each part of the day in hours on a 12-hour clock, its day period once when shared", () => {
    expect(getScoreTimePeriodRange({ locale: "en", period: 0 })).toBe("12–6 AM");
    expect(getScoreTimePeriodRange({ locale: "en", period: 1 })).toBe("6 AM–12 PM");
    expect(getScoreTimePeriodRange({ locale: "en", period: 2 })).toBe("12–6 PM");
    expect(getScoreTimePeriodRange({ locale: "en", period: 3 })).toBe("6 PM–12 AM");
  });

  it("says each part of the day in two-digit hours on a 24-hour clock, the day ending at 24", () => {
    expect(getScoreTimePeriodRange({ locale: "pt", period: 0 })).toBe("00–06");
    expect(getScoreTimePeriodRange({ locale: "de", period: 1 })).toBe("06–12");
    expect(getScoreTimePeriodRange({ locale: "fr", period: 2 })).toBe("12–18");
    expect(getScoreTimePeriodRange({ locale: "es", period: 3 })).toBe("18–24");
  });
});
