import { describe, expect, it } from "vitest";
import { getSuggestedTime } from "./suggested-time";

const AT_FOUR_HOURS = { coreFits: false, coveredShare: 0.3214 };

describe(getSuggestedTime, () => {
  it("suggests the time that covers everything, up to four hours a day", () => {
    expect(
      getSuggestedTime({ coverageAt: () => AT_FOUR_HOURS, everything: 240, most: null }),
    ).toStrictEqual({ coveredShare: 1, everyTopic: true, kind: "everything", minutes: 240 });
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
        most: null,
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

  it("suggests the least time that covers as much as any does when part never fits", () => {
    const suggested = getSuggestedTime({
      coverageAt: () => ({ coreFits: true, coveredShare: 0.99 }),
      everything: null,
      most: { coveredShare: 0.99, minutes: 180 },
    });

    expect(suggested).toStrictEqual({
      coveredShare: 0.99,
      everyTopic: true,
      kind: "focus",
      minutes: 180,
    });
  });

  it("keeps to four hours when covering the most possible takes longer", () => {
    expect(
      getSuggestedTime({
        coverageAt: () => AT_FOUR_HOURS,
        everything: null,
        most: { coveredShare: 0.99, minutes: 480 },
      }),
    ).toMatchObject({ kind: "focus", minutes: 240 });
  });
});
