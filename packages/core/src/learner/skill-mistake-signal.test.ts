import { describe, expect, it } from "vitest";
import {
  type SkillSignalAttempt,
  type SkillTeachingHistory,
  getSkillMistakeSignal,
} from "./skill-mistake-signal";

const NOW = new Date("2026-11-26T18:00:00Z");
const HISTORY = { helpedAt: null, replayedAt: null, secondTakeAt: null };

function attempt(
  day: number,
  id: string,
  overrides: Partial<SkillSignalAttempt> = {},
): SkillSignalAttempt {
  return {
    answeredAt: new Date(Date.UTC(2026, 10, day, 12)),
    cause: "gap",
    evidence: "independent",
    id,
    isCorrect: false,
    itemId: id,
    localDate: new Date(Date.UTC(2026, 10, day)),
    mockExamId: null,
    stepId: null,
    ...overrides,
  };
}

function right(day: number, id: string, evidence: SkillSignalAttempt["evidence"] = "independent") {
  return attempt(day, id, { cause: null, evidence, isCorrect: true });
}

function signal(attempts: readonly SkillSignalAttempt[], history: SkillTeachingHistory = HISTORY) {
  return getSkillMistakeSignal({ attempts, history, now: NOW });
}

describe(getSkillMistakeSignal, () => {
  it.each([null, "guess", "time", "misread"] as const)(
    "ignores a miss attributed to %s",
    (cause) => {
      expect(signal([attempt(24, "gap"), attempt(25, "other", { cause })])).toMatchObject({
        latestMiss: { id: "gap" },
        stuck: false,
      });
    },
  );

  it("does not treat a single slip as a stuck skill", () => {
    expect(signal([right(22, "a"), attempt(23, "b"), right(24, "c")]).stuck).toBe(false);
  });

  it("detects alternating misses and rights even after a notebook replay gets the right answer", () => {
    const attempts = [
      attempt(20, "a"),
      right(21, "b"),
      attempt(22, "c", { cause: "trap" }),
      right(23, "d"),
      right(24, "c", "replay"),
      right(25, "e", "guided"),
    ];

    expect(signal(attempts)).toMatchObject({ latestMiss: { id: "c" }, stuck: true });
  });

  it("counts a question once per local day and requires two different mock questions to count on that day", () => {
    const first = attempt(24, "a", { mockExamId: "mock" });
    const repeated = attempt(24, "b", { evidence: "replay", itemId: "a", mockExamId: "mock" });
    const other = attempt(24, "c", { mockExamId: "mock" });

    expect(signal([first, repeated]).stuck).toBe(false);
    expect(signal([first, other]).stuck).toBe(true);
    expect(signal([first, { ...other, mockExamId: "other" }]).stuck).toBe(false);
  });

  it("ends an episode after independent rights on different days, then starts fresh", () => {
    const stuck = [attempt(20, "a"), attempt(21, "b")];

    expect(signal([...stuck, right(24, "c"), right(24, "d")]).stuck).toBe(true);
    expect(signal([...stuck, right(24, "c"), right(25, "d")]).stuck).toBe(false);
    expect(signal([...stuck, right(24, "c"), right(25, "d"), attempt(26, "e")]).stuck).toBe(false);
  });

  it("requires at least half misses even when a prior episode ended", () => {
    expect(
      signal([
        right(21, "a"),
        right(22, "b"),
        right(23, "c"),
        right(24, "d"),
        attempt(25, "e"),
        attempt(26, "f"),
      ]).stuck,
    ).toBe(false);
  });

  it("drops evidence older than 28 days", () => {
    expect(signal([attempt(-5, "old"), attempt(24, "recent")])).toMatchObject({
      latestMiss: { id: "recent" },
      stuck: false,
    });
  });

  it("uses the six latest counted answers", () => {
    expect(
      signal([
        attempt(18, "a"),
        attempt(19, "b"),
        right(22, "c"),
        right(23, "d"),
        right(24, "e"),
        attempt(25, "f"),
        right(26, "g"),
      ]),
    ).toMatchObject({ latestMiss: { id: "f" }, stuck: false });
  });

  it("requires a miss at least seven days after the replay and stops after the second take", () => {
    const replayedAt = new Date("2026-11-16T12:00:00Z");
    const history = { ...HISTORY, helpedAt: replayedAt, replayedAt };

    expect(signal([attempt(20, "a"), attempt(22, "b")], history)).toMatchObject({
      dueSecondTake: false,
      stage: "replay",
      stuck: true,
    });

    expect(signal([attempt(20, "a"), attempt(23, "b")], history)).toMatchObject({
      dueSecondTake: true,
      stage: "replay",
      stuck: true,
    });

    expect(
      signal([attempt(20, "a"), attempt(23, "b")], {
        ...history,
        secondTakeAt: new Date("2026-11-24T12:00:00Z"),
      }),
    ).toMatchObject({ dueSecondTake: false, stage: "secondTake" });
  });

  it.each([
    { dueSecondTake: true, replayedAt: "2026-09-24T12:00:00Z", stage: "replay" },
    { dueSecondTake: false, replayedAt: "2026-09-24T11:59:59Z", stage: "none" },
  ])(
    "counts a replay that falls within 60 days of the last miss ($stage)",
    ({ dueSecondTake, replayedAt, stage }) => {
      expect(
        signal([attempt(22, "a"), attempt(23, "b")], {
          ...HISTORY,
          replayedAt: new Date(replayedAt),
        }),
      ).toMatchObject({ dueSecondTake, stage, stuck: true });
    },
  );

  it("discards mock misses before first teaching and ignores null evidence", () => {
    const mock = [
      attempt(23, "a", { mockExamId: "mock" }),
      attempt(23, "b", { mockExamId: "mock" }),
    ];

    expect(signal(mock).stuck).toBe(true);

    expect(
      signal([...mock, attempt(25, "c", { evidence: null })], {
        ...HISTORY,
        helpedAt: new Date("2026-11-24T12:00:00Z"),
      }),
    ).toMatchObject({ latestMiss: null, stuck: false });
  });

  it("ignores unclassified writing and counts linked writing gaps", () => {
    const first = attempt(24, "a", {
      cause: null,
      evidence: "guided",
      itemId: null,
      stepId: "step",
    });

    const later = attempt(25, "b", {
      cause: null,
      evidence: "replay",
      itemId: null,
      stepId: "step",
    });

    expect(signal([first, later]).stuck).toBe(false);

    expect(
      signal([
        { ...first, cause: "gap" },
        { ...later, cause: "gap" },
      ]).stuck,
    ).toBe(true);
  });
});
