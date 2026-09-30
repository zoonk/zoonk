import { describe, expect, it } from "vitest";
import {
  getScoreWeekdayLabel,
  getScoreWeekdayMessageValue,
  getScoreWeekdayShortLabel,
} from "./weekday";

describe("score weekdays", () => {
  it("names each stored weekday index, Sunday first, in the learner's locale", () => {
    const english = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) =>
      getScoreWeekdayLabel({ dayOfWeek, locale: "en" }),
    );

    expect(english).toStrictEqual([
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]);

    expect(getScoreWeekdayLabel({ dayOfWeek: 0, locale: "pt" })).toBe("domingo");
    expect(getScoreWeekdayShortLabel({ dayOfWeek: 6, locale: "en" })).toBe("Sat");
  });

  it("gives ICU select messages the weekday's value, and other for an unknown index", () => {
    expect(getScoreWeekdayMessageValue(0)).toBe("sunday");
    expect(getScoreWeekdayMessageValue(6)).toBe("saturday");
    expect(getScoreWeekdayMessageValue(7)).toBe("other");
  });
});
