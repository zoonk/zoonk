import { describe, expect, it } from "vitest";
import {
  type FocusCandidate,
  getPaceMs,
  getSessionQuestions,
  getSittingMinutes,
  getSittingQuestions,
  hasUnknownStreak,
  rankFocus,
} from "./focus-test-rules";

const MINUTE = 60_000;

function firstSitting(quickSubjects: number, paceMs = MINUTE) {
  const questions = getSittingQuestions({ kind: "first", paceMs, quickSubjects });
  return { minutes: getSittingMinutes({ paceMs, questions }), questions };
}

describe("a sitting's promised count", () => {
  it("fits a first sitting into about fifteen minutes at the starting pace", () => {
    expect(firstSitting(24)).toEqual({ minutes: 15, questions: 15 });
    expect(firstSitting(40)).toEqual({ minutes: 15, questions: 15 });
  });

  it("asks at most four questions a subject when the exam has few", () => {
    expect(firstSitting(3)).toEqual({ minutes: 12, questions: 12 });
    expect(firstSitting(2)).toEqual({ minutes: 8, questions: 8 });
    expect(firstSitting(1)).toEqual({ minutes: 4, questions: 4 });
  });

  it("sizes a first sitting to the exam once the pace leaves room", () => {
    const fast = 20_000;

    expect(firstSitting(12, fast).questions).toBe(20);
    expect(firstSitting(24, fast).questions).toBe(24);
    expect(firstSitting(40, fast).questions).toBe(30);
  });

  it("offers a further sitting of up to ten questions, timed from the same count", () => {
    const questions = getSittingQuestions({
      kind: "continuation",
      paceMs: MINUTE,
      quickSubjects: 24,
    });

    expect(questions).toBe(10);
    expect(getSittingMinutes({ paceMs: MINUTE, questions })).toBe(10);
    expect(getSittingMinutes({ paceMs: 45_000, questions })).toBe(8);
  });

  it("shortens a further sitting for a learner who takes longer", () => {
    expect(
      getSittingQuestions({ kind: "continuation", paceMs: 2 * MINUTE, quickSubjects: 24 }),
    ).toBe(7);
  });

  it("never promises a minute for no questions, and at least one for any", () => {
    expect(getSittingMinutes({ paceMs: MINUTE, questions: 0 })).toBe(0);
    expect(getSittingMinutes({ paceMs: 8000, questions: 2 })).toBe(1);
  });
});

describe("the learner's pace", () => {
  it("starts at a minute a question until five answers say otherwise", () => {
    expect(getPaceMs([])).toBe(MINUTE);
    expect(getPaceMs([8000, 8000, 8000, 8000])).toBe(MINUTE);
  });

  it("is the mean of their answers, quick taps included", () => {
    expect(getPaceMs([70_000, 70_000, 70_000, 8000, 8000])).toBe(45_200);
  });

  it("counts a break in the middle of a question as three minutes at most", () => {
    expect(getPaceMs([60_000, 60_000, 60_000, 60_000, 900_000])).toBe(84_000);
  });
});

describe('the hint after "I don\'t know yet" answers', () => {
  it("shows after five in a row and goes once the learner answers", () => {
    const unknown = Array.from({ length: 5 }, () => "dontKnow" as const);

    expect(hasUnknownStreak(unknown.slice(1))).toBe(false);
    expect(hasUnknownStreak(["correct", ...unknown])).toBe(true);
    expect(hasUnknownStreak([...unknown, "wrong"])).toBe(false);
  });
});

function candidate(overrides: Partial<FocusCandidate> & { key: string }): FocusCandidate {
  return {
    asked: false,
    belief: 0.5,
    minimumScore: false,
    missed: false,
    part: null,
    share: 0.1,
    ...overrides,
  };
}

describe("the suggested focus", () => {
  it("ranks by the exam's share times what the answers leave unknown", () => {
    const ranked = rankFocus([
      candidate({ asked: true, belief: 0.9, key: "right" }),
      candidate({ key: "notAsked" }),
      candidate({ asked: true, belief: 0.1, key: "missed", missed: true }),
      candidate({ key: "written", part: "written" }),
      candidate({ key: "light", share: 0.01 }),
      candidate({ key: "heavy", share: 0.3 }),
    ]);

    expect(ranked).toEqual([
      { key: "heavy", reason: "notAsked" },
      { key: "missed", reason: "answers" },
    ]);
  });

  it("keeps a part the test can't check eligible, and says why it's there", () => {
    const ranked = rankFocus([
      candidate({ asked: true, belief: 0.9, key: "a" }),
      candidate({ key: "essay", part: "written", share: 0.3 }),
      candidate({ key: "qualifying", minimumScore: true, share: 0.2 }),
      candidate({ asked: true, belief: 0.9, key: "b" }),
      candidate({ asked: true, belief: 0.9, key: "c" }),
      candidate({ asked: true, belief: 0.9, key: "d" }),
    ]);

    expect(ranked).toEqual([
      { key: "essay", reason: "notChecked" },
      { key: "qualifying", reason: "minimumScore" },
    ]);
  });

  it("names a subject answered right that still weighs most", () => {
    const ranked = rankFocus([
      candidate({ asked: true, belief: 0.8, key: "heavy", share: 0.6 }),
      candidate({ key: "light", share: 0.05 }),
    ]);

    expect(ranked).toEqual([{ key: "heavy", reason: "weight" }]);
  });

  it("suggests one subject in three, three at most, and none for a single subject", () => {
    const subjects = (count: number) =>
      Array.from({ length: count }, (_, index) => candidate({ key: `subject-${index}` }));

    expect(rankFocus(subjects(1))).toHaveLength(0);
    expect(rankFocus(subjects(2))).toHaveLength(1);
    expect(rankFocus(subjects(5))).toHaveLength(1);
    expect(rankFocus(subjects(6))).toHaveLength(2);
    expect(rankFocus(subjects(24))).toHaveLength(3);
  });

  it("leaves out a subject the learner fully knows", () => {
    expect(
      rankFocus([candidate({ asked: true, belief: 1, key: "known" }), candidate({ key: "other" })]),
    ).toEqual([{ key: "other", reason: "notAsked" }]);
  });
});

describe("the test's questions inside sessions", () => {
  const started = {
    complete: false,
    goalDay: 2,
    paused: false,
    skippedToday: false,
    started: true,
    unaskedSubjects: true,
  };

  it("stay off until the learner starts the test", () => {
    expect(getSessionQuestions({ ...started, started: false })).toBe("off");
  });

  it("are asked through the first week", () => {
    expect(getSessionQuestions({ ...started, unaskedSubjects: false })).toBe("on");
  });

  it("go on past the first week while a subject has no answer, then stop", () => {
    expect(getSessionQuestions({ ...started, goalDay: 20 })).toBe("on");
    expect(getSessionQuestions({ ...started, goalDay: 20, unaskedSubjects: false })).toBe("off");
  });

  it("stop once nothing useful is left to ask", () => {
    expect(getSessionQuestions({ ...started, complete: true })).toBe("off");
  });

  it("follow the learner's pause and their not today", () => {
    expect(getSessionQuestions({ ...started, skippedToday: true })).toBe("skippedToday");
    expect(getSessionQuestions({ ...started, paused: true, skippedToday: true })).toBe("paused");
  });
});
