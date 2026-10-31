import { describe, expect, it } from "vitest";
import { getSuggestedTime } from "./suggested-time";

const AT_FOUR_HOURS = { coreFits: false, coveredShare: 0.3214 };

describe(getSuggestedTime, () => {
  it("suggests the time that covers everything, up to four hours a day", () => {
    expect(getSuggestedTime({ coverageAt: () => AT_FOUR_HOURS, everything: 240 })).toStrictEqual({
      coveredShare: 1,
      everyTopic: true,
      kind: "everything",
      minutes: 240,
    });
  });

  it.each([805, null])(
    "suggests four hours, with what they cover, when everything takes %o minutes",
    (everything) => {
      const asked: number[] = [];

      const suggested = getSuggestedTime({
        coverageAt: (minutes) => {
          asked.push(minutes);
          return AT_FOUR_HOURS;
        },
        everything,
      });

      expect(suggested).toStrictEqual({
        coveredShare: 0.32,
        everyTopic: false,
        kind: "focus",
        minutes: 240,
      });

      expect(asked).toStrictEqual([240]);
    },
  );
});
