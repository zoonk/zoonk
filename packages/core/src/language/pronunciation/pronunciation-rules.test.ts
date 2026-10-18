import { describe, expect, it } from "vitest";
import {
  nextPronunciationReview,
  schedulePronunciationMiss,
  toReviewWord,
} from "./pronunciation-rules";

// 21:30 in São Paulo (UTC-3) on September 27.
const EVENING = new Date("2026-09-28T00:30:00.000Z");
const TIME_ZONE = "America/Sao_Paulo";

describe(schedulePronunciationMiss, () => {
  it("brings a missed word back at the start of the learner's next day", () => {
    expect(schedulePronunciationMiss({ now: EVENING, timeZone: TIME_ZONE })).toStrictEqual({
      dueAt: new Date("2026-09-28T03:00:00.000Z"),
      stage: 0,
    });
  });
});

describe(nextPronunciationReview, () => {
  it("climbs to three days, then a week, then leaves the reviews", () => {
    const first = nextPronunciationReview({
      isCorrect: true,
      now: EVENING,
      stage: 0,
      timeZone: TIME_ZONE,
    });

    expect(first).toStrictEqual({ dueAt: new Date("2026-09-30T03:00:00.000Z"), stage: 1 });

    const second = nextPronunciationReview({
      isCorrect: true,
      now: EVENING,
      stage: 1,
      timeZone: TIME_ZONE,
    });

    expect(second).toStrictEqual({ dueAt: new Date("2026-10-04T03:00:00.000Z"), stage: 2 });

    expect(
      nextPronunciationReview({ isCorrect: true, now: EVENING, stage: 2, timeZone: TIME_ZONE }),
    ).toStrictEqual({ dueAt: null, stage: 3 });
  });

  it("starts over at the next day after a miss on any rung", () => {
    expect(
      nextPronunciationReview({ isCorrect: false, now: EVENING, stage: 2, timeZone: TIME_ZONE }),
    ).toStrictEqual({ dueAt: new Date("2026-09-28T03:00:00.000Z"), stage: 0 });
  });
});

describe(toReviewWord, () => {
  it("drops the punctuation around a word and keeps what's inside it", () => {
    expect(toReviewWord("rent?")).toBe("rent");
    expect(toReviewWord("¿Cuánto")).toBe("Cuánto");
    expect(toReviewWord("don't,")).toBe("don't");
    expect(toReviewWord("«l'eau»")).toBe("l'eau");
  });
});
