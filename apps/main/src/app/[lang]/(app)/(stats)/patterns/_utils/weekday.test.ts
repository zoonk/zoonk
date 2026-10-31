import { describe, expect, it } from "vitest";
import { getScoreWeekdayLabel } from "./weekday";

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
  });
});
