import { describe, expect, it } from "vitest";
import { getSuggestedTime } from "./suggested-time";

const AT_FOUR_HOURS = { coreFits: false, coveredShare: 0.3214 };

describe(getSuggestedTime, () => {
  it.each([150, 240])("suggests %i minutes when that fits everything", (minutes) => {
    expect(
      getSuggestedTime({ coverageAt: () => AT_FOUR_HOURS, everything: minutes, most: null }),
    ).toStrictEqual({ coveredShare: 1, everyTopic: true, kind: "everything", minutes });
  });

  it.each([600, null])(
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

  it.each([0.996, 1])(
    "never shows a focus with depth coverage %f as everything",
    (coveredShare) => {
      expect(
        getSuggestedTime({
          coverageAt: () => ({ coreFits: true, coveredShare }),
          everything: 300,
          most: null,
        }),
      ).toMatchObject({ coveredShare: 0.99, kind: "focus", minutes: 240 });
    },
  );

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
