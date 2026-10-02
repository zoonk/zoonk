import { describe, expect, it } from "vitest";
import { getScoreTimePeriodRange } from "./time-period";

describe(getScoreTimePeriodRange, () => {
  it("formats each fixed time bucket using the learner locale", () => {
    expect(getScoreTimePeriodRange({ locale: "en", period: 0 })).toBe("12:00 AM–6:00 AM");
    expect(getScoreTimePeriodRange({ locale: "en", period: 1 })).toBe("6:00 AM–12:00 PM");
    expect(getScoreTimePeriodRange({ locale: "en", period: 2 })).toBe("12:00 PM–6:00 PM");
    expect(getScoreTimePeriodRange({ locale: "en", period: 3 })).toBe("6:00 PM–12:00 AM");
    expect(getScoreTimePeriodRange({ locale: "pt", period: 0 })).toBe("00:00–06:00");
  });
});
