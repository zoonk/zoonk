import { describe, expect, it } from "vitest";
import { type GradedAnswer } from "./answer-rating";
import {
  NEW_SKILL_MEMORY,
  type SkillMemory,
  getSkillRetrievability,
  reviewSkillMemory,
} from "./fsrs-scheduler";

const TIME_ZONE = "America/Sao_Paulo";
const RIGHT = { durationMs: 15_000, isCorrect: true };
const WRONG = { durationMs: 15_000, isCorrect: false };

function review(
  memory: SkillMemory,
  reviewedAt: string,
  answer: GradedAnswer = RIGHT,
  timeZone = TIME_ZONE,
) {
  return reviewSkillMemory({ answer, memory, reviewedAt: new Date(reviewedAt), timeZone });
}

function learn(memory: SkillMemory, reviewedAt: string, answer: GradedAnswer = RIGHT) {
  return reviewSkillMemory({
    answer,
    learning: true,
    memory,
    reviewedAt: new Date(reviewedAt),
    timeZone: TIME_ZONE,
  });
}

describe(reviewSkillMemory, () => {
  it("brings a skill taught today back the next day, then lets FSRS space it", () => {
    // Taught on September 1st in São Paulo: three right answers in the lesson.
    const taught = ["2026-09-01T23:00:00Z", "2026-09-01T23:02:00Z", "2026-09-01T23:04:00Z"].reduce(
      (memory, at) => learn(memory, at),
      NEW_SKILL_MEMORY,
    );

    // Midnight of September 2nd in São Paulo: the next day's review.
    expect(taught.due).toStrictEqual(new Date("2026-09-02T03:00:00Z"));

    expect(review(NEW_SKILL_MEMORY, "2026-09-01T23:00:00Z").due?.getTime()).toBeGreaterThan(
      new Date("2026-09-02T03:00:00Z").getTime(),
    );

    const recalled = learn(taught, "2026-09-02T12:00:00Z");

    expect(recalled.recallDays).toBe(1);
    expect(recalled.due?.getTime()).toBeGreaterThan(new Date("2026-09-04T03:00:00Z").getTime());
  });

  it("brings a skill relearned after a lapse back the next day", () => {
    const taught = learn(NEW_SKILL_MEMORY, "2026-09-01T12:00:00Z");
    const recalled = learn(taught, "2026-09-02T12:00:00Z");
    const lapsed = learn(recalled, "2026-09-20T12:00:00Z", WRONG);
    const relearned = learn(lapsed, "2026-09-20T12:05:00Z");

    expect(relearned.recallDays).toBe(0);
    expect(relearned.due).toStrictEqual(new Date("2026-09-21T03:00:00Z"));
  });

  it("leaves what a diagnostic showed the learner knew to FSRS alone", () => {
    const known = review(NEW_SKILL_MEMORY, "2026-09-01T12:00:00Z");

    expect(known.due?.getTime()).toBeGreaterThan(new Date("2026-09-02T03:00:00Z").getTime());
  });

  it("starts a new skill as Learning with a first FSRS review", () => {
    const memory = review(NEW_SKILL_MEMORY, "2026-09-01T23:00:00Z");

    expect(memory).toMatchObject({ lapses: 0, recallDays: 0, reps: 1, state: "learning" });
    expect(memory.stability).toBeGreaterThan(0);
    expect(memory.lastReviewedAt).toStrictEqual(new Date("2026-09-01T23:00:00Z"));
  });

  it("schedules the next review at the start of the learner's due day", () => {
    const memory = review(NEW_SKILL_MEMORY, "2026-09-01T23:00:00Z");

    // Midnight in São Paulo (UTC-3) is 03:00 UTC.
    expect(memory.due?.toISOString()).toMatch(/T03:00:00\.000Z$/u);
    expect(memory.due?.getTime()).toBeGreaterThan(new Date("2026-09-02T03:00:00Z").getTime());
  });

  it("keeps stability for another right answer on the same local day", () => {
    const first = review(NEW_SKILL_MEMORY, "2026-09-01T23:00:00Z");
    // 21:30 in São Paulo is still September 1st there, although it is September 2nd in UTC.
    const sameDay = review(first, "2026-09-02T00:30:00Z");

    expect(sameDay.stability).toBe(first.stability);
    expect(sameDay.due).toStrictEqual(first.due);
    expect(sameDay).toMatchObject({ recallDays: 0, reps: 2 });
  });

  it("lowers stability for a wrong answer on the same day", () => {
    const first = review(NEW_SKILL_MEMORY, "2026-09-01T12:00:00Z");
    const wrong = review(first, "2026-09-01T12:05:00Z", WRONG);

    expect(wrong.stability).toBeLessThan(first.stability);
    expect(wrong.difficulty).toBeGreaterThan(first.difficulty);
  });

  it("counts recall days only on later days and masters a skill on the third", () => {
    const learned = review(NEW_SKILL_MEMORY, "2026-09-01T12:00:00Z");
    const second = review(learned, "2026-09-04T12:00:00Z");
    const third = review(second, "2026-09-12T12:00:00Z");
    const fourth = review(third, "2026-10-05T12:00:00Z");

    expect(second).toMatchObject({ recallDays: 1, state: "solid" });
    expect(third).toMatchObject({ recallDays: 2, state: "solid" });
    expect(fourth).toMatchObject({ recallDays: 3, state: "mastered" });
    expect(fourth.stability).toBeGreaterThan(third.stability);
  });

  it("starts the recall count over after a lapse on a later day", () => {
    const learned = review(NEW_SKILL_MEMORY, "2026-09-01T12:00:00Z");
    const recalled = review(learned, "2026-09-04T12:00:00Z");
    const lapsed = review(recalled, "2026-09-20T12:00:00Z", WRONG);

    expect(lapsed).toMatchObject({ lapses: 1, recallDays: 0, state: "learning" });
    expect(lapsed.stability).toBeLessThan(recalled.stability);
  });

  it("doesn't count a right answer with a hint as remembering", () => {
    const learned = review(NEW_SKILL_MEMORY, "2026-09-01T12:00:00Z");
    const hinted = review(learned, "2026-09-04T12:00:00Z", { ...RIGHT, usedHint: true });

    expect(hinted.recallDays).toBe(0);
    expect(hinted.reps).toBe(2);
  });

  it("rates a fast first answer Good, not Easy, since the skill was just taught", () => {
    const fast = review(NEW_SKILL_MEMORY, "2026-09-01T12:00:00Z", {
      durationMs: 1000,
      isCorrect: true,
    });

    const normal = review(NEW_SKILL_MEMORY, "2026-09-01T12:00:00Z");

    expect(fast.stability).toBe(normal.stability);
  });
});

describe(getSkillRetrievability, () => {
  it("is null for a skill never answered", () => {
    expect(getSkillRetrievability({ memory: NEW_SKILL_MEMORY, now: new Date() })).toBeNull();
  });

  it("starts at 1 and falls over time, reaching about 90% at the stability", () => {
    const memory = review(NEW_SKILL_MEMORY, "2026-09-01T12:00:00Z");
    const reviewedAt = new Date("2026-09-01T12:00:00Z").getTime();
    const dayMs = 86_400_000;

    const atReview = getSkillRetrievability({ memory, now: new Date(reviewedAt) });

    const atStability = getSkillRetrievability({
      memory,
      now: new Date(reviewedAt + memory.stability * dayMs),
    });

    const muchLater = getSkillRetrievability({ memory, now: new Date(reviewedAt + 60 * dayMs) });

    expect(atReview).toBe(1);
    expect(atStability).toBeCloseTo(0.9, 2);
    expect(muchLater).toBeLessThan(atStability ?? 0);
  });
});
