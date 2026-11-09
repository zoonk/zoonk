import { describe, expect, it } from "vitest";
import { selectMistakeDrill, selectMistakesToPractice, selectPracticeRun } from "./mistake-drills";

const CANDIDATES = [
  { hasMisconceptions: false, id: "original", seen: true },
  { hasMisconceptions: false, id: "seen-plain", seen: true },
  { hasMisconceptions: false, id: "new-plain", seen: false },
  { hasMisconceptions: true, id: "new-trap", seen: false },
  { hasMisconceptions: true, id: "seen-trap", seen: true },
];

describe(selectMistakeDrill, () => {
  it("re-teaches a content gap with the lesson and two new questions", () => {
    expect(
      selectMistakeDrill({
        candidates: CANDIDATES,
        cause: "gap",
        lessonId: "lesson",
        originalItemId: "original",
      }),
    ).toStrictEqual({
      itemIds: ["original", "new-plain", "new-trap"],
      kind: "reteach",
      lessonId: "lesson",
      timeLimitSeconds: null,
    });
  });

  it("drills traps with questions whose wrong options carry misconceptions", () => {
    const drill = selectMistakeDrill({
      candidates: CANDIDATES,
      cause: "trap",
      lessonId: "lesson",
      originalItemId: "original",
    });

    expect(drill).toMatchObject({
      itemIds: ["original", "new-trap", "seen-trap"],
      kind: "spotTheTrap",
      lessonId: null,
    });
  });

  it("times the drill for a mistake made by running out of time", () => {
    const drill = selectMistakeDrill({
      candidates: CANDIDATES,
      cause: "time",
      lessonId: null,
      originalItemId: "original",
    });

    expect(drill.kind).toBe("timed");
    expect(drill.timeLimitSeconds).toBeGreaterThan(0);
  });

  it("retries a mistake whose cause isn't known yet", () => {
    expect(
      selectMistakeDrill({
        candidates: CANDIDATES,
        cause: null,
        lessonId: null,
        originalItemId: "original",
      }).kind,
    ).toBe("retry");
  });

  it("works when the original question is gone", () => {
    const drill = selectMistakeDrill({
      candidates: CANDIDATES,
      cause: "misread",
      lessonId: null,
      originalItemId: null,
    });

    expect(drill.itemIds).toStrictEqual(["new-plain"]);
  });
});

function day(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

describe(selectMistakesToPractice, () => {
  it("takes the oldest mistakes, one per skill first, and none from today", () => {
    const picked = selectMistakesToPractice({
      limit: 3,
      mistakes: [
        { createdLocalDate: day("2026-09-01"), id: "m1", skillId: "a" },
        { createdLocalDate: day("2026-09-02"), id: "m2", skillId: "a" },
        { createdLocalDate: day("2026-09-03"), id: "m3", skillId: "b" },
        { createdLocalDate: day("2026-09-04"), id: "m4", skillId: "c" },
        { createdLocalDate: day("2026-09-10"), id: "today", skillId: "d" },
      ],
      today: day("2026-09-10"),
    });

    expect(picked.map((mistake) => mistake.id)).toStrictEqual(["m1", "m3", "m4"]);
  });
});

function candidate(id: string, skillId: string) {
  return { hasMisconceptions: false, id, seen: false, skillId };
}

/** Candidates are on skill "k" unless `skillOf` says otherwise, and so is the mistake. */
function runMistake(
  mistakeId: string,
  {
    candidates,
    cause = "gap",
    coveringSkillIds = ["k"],
    lessonId = null,
    own = null,
    skillOf = {},
  }: {
    candidates: string[];
    cause?: "gap" | "misread";
    coveringSkillIds?: string[];
    lessonId?: string | null;
    own?: string | null;
    skillOf?: Record<string, string>;
  },
) {
  return {
    candidates: candidates.map((id) => candidate(id, skillOf[id] ?? "k")),
    cause,
    coveringSkillIds,
    lessonId,
    mistakeId,
    originalItemId: own,
  };
}

function asked(run: ReturnType<typeof selectPracticeRun<ReturnType<typeof runMistake>>>) {
  return run.map(({ drill, mistakeId }) => [mistakeId, drill.itemIds]);
}

describe(selectPracticeRun, () => {
  it("asks one question per mistake, its own, however many its skill has", () => {
    const run = selectPracticeRun([
      runMistake("m1", { candidates: ["a", "b", "c"], own: "a" }),
      runMistake("m2", { candidates: ["a", "b", "c"], own: "b" }),
    ]);

    expect(asked(run)).toStrictEqual([
      ["m1", ["a"]],
      ["m2", ["b"]],
    ]);
  });

  it("never hands a mistake's own question to an earlier mistake", () => {
    const run = selectPracticeRun([
      runMistake("no-own", { candidates: ["taken", "free"] }),
      runMistake("own", { candidates: ["taken", "free"], own: "taken" }),
    ]);

    expect(asked(run)).toStrictEqual([
      ["no-own", ["free"]],
      ["own", ["taken"]],
    ]);
  });

  it("asks one question for mistakes with no question of their own on one skill", () => {
    const run = selectPracticeRun([
      runMistake("m1", { candidates: ["a", "b"] }),
      runMistake("m2", { candidates: ["a", "b"] }),
    ]);

    expect(asked(run)).toStrictEqual([["m1", ["a"]]]);
  });

  it("leaves out a mistake with no question of its own once another's own question is on its skill", () => {
    const run = selectPracticeRun([
      runMistake("own", { candidates: ["outside"], own: "outside", skillOf: { outside: "k" } }),
      runMistake("no-own", { candidates: ["a", "b"], coveringSkillIds: ["k"] }),
    ]);

    expect(asked(run)).toStrictEqual([["own", ["outside"]]]);
  });

  it("leaves out a mistake with no question of its own once its skill has one in the run", () => {
    const run = selectPracticeRun([
      runMistake("own", { candidates: ["a", "b"], own: "a" }),
      runMistake("no-own", { candidates: ["a", "b"] }),
      runMistake("elsewhere", {
        candidates: ["other"],
        coveringSkillIds: ["elsewhere"],
        skillOf: { other: "elsewhere" },
      }),
    ]);

    expect(asked(run)).toStrictEqual([
      ["own", ["a"]],
      ["elsewhere", ["other"]],
    ]);
  });

  it("leaves a mistake out rather than asking a question twice", () => {
    const run = selectPracticeRun([
      runMistake("m1", { candidates: ["only"] }),
      runMistake("m2", { candidates: ["only"] }),
      runMistake("m3", { candidates: ["only"] }),
    ]);

    expect(asked(run)).toStrictEqual([["m1", ["only"]]]);
  });

  it("asks a question once when two mistakes both have it as their own", () => {
    const run = selectPracticeRun([
      runMistake("m1", { candidates: ["same"], own: "same" }),
      runMistake("m2", { candidates: ["same"], own: "same" }),
    ]);

    expect(asked(run)).toStrictEqual([["m1", ["same"]]]);
  });

  it("goes over a lesson the first time only, so its idea doesn't come back between questions", () => {
    const run = selectPracticeRun([
      runMistake("m1", { candidates: ["a"], lessonId: "lesson", own: "a" }),
      runMistake("m2", { candidates: ["b"], lessonId: "lesson", own: "b" }),
      runMistake("m3", { candidates: ["c"], lessonId: "other", own: "c" }),
    ]);

    expect(run.map(({ drill }) => drill.lessonId)).toStrictEqual(["lesson", null, "other"]);
  });

  it("keeps the drill the mistake's cause calls for", () => {
    const [entry] = selectPracticeRun([
      runMistake("misread", { candidates: ["a"], cause: "misread", own: "a" }),
    ]);

    expect(entry?.drill.kind).toBe("readCarefully");
  });
});
