import { NOTHING_REACHED } from "@zoonk/core/sessions/reached";
import { describe, expect, it } from "vitest";
import {
  type MistakePracticeSummary,
  type PracticeEntry,
  createPracticeState,
  getPracticeSegments,
  isMistakeQuestion,
  practiceReducer,
} from "./mistake-practice-state";

function entry(
  mistakeId: string,
  drill: Partial<PracticeEntry["drill"]> = {},
  questions = 2,
): PracticeEntry {
  return {
    cause: null,
    drill: { kind: "retry", lesson: null, timeLimitSeconds: null, ...drill },
    mistakeId,
    questions: Array.from({ length: questions }, (_, index) => ({
      context: null,
      format: "multipleChoice" as const,
      image: null,
      itemId: `${mistakeId}-${index}`,
      options: ["Right", "Wrong"],
      question: `Question ${index}?`,
      select: 1 as const,
      set: null,
      skillId: "skill",
      visual: null,
    })),
    snapshot: { answer: "Wrong", question: "Question 0?" },
  };
}

const LESSON = { id: "lesson", ideas: ["An idea."], title: "Lesson" };

function graded(answerId: string, fixed = false) {
  return {
    answerId,
    correctAnswer: { selectedIndex: 0 },
    explanation: null,
    fixed,
    fixedMistakeIds: [],
    isCorrect: true,
    mistakeStatus: fixed ? ("fixed" as const) : ("open" as const),
    reached: NOTHING_REACHED,
    trap: null,
  };
}

/** The run's end as core counts it, reaching nothing new by itself. */
const SUMMARY: MistakePracticeSummary = {
  brainPower: 20,
  ceremony: null,
  correct: 2,
  missionMoment: null,
  reached: NOTHING_REACHED,
  seconds: 60,
  total: 2,
};

describe(createPracticeState, () => {
  it("opens a content gap on its idea, before its first question", () => {
    const practice = [entry("gap", { kind: "reteach", lesson: LESSON })];
    expect(createPracticeState(practice).phase).toStrictEqual({ kind: "idea" });
  });

  it("asks straight away when a gap's lesson is gone", () => {
    const practice = [entry("gap", { kind: "reteach", lesson: null })];

    expect(createPracticeState(practice).phase).toStrictEqual({
      kind: "answering",
      selected: null,
    });
  });

  it("asks straight away when a gap's lesson has no summary to show", () => {
    const practice = [entry("gap", { kind: "reteach", lesson: { ...LESSON, ideas: [] } })];

    expect(createPracticeState(practice).phase).toStrictEqual({
      kind: "answering",
      selected: null,
    });
  });

  it("shows a misread's question before its answers", () => {
    const practice = [entry("misread", { kind: "readCarefully" })];
    expect(createPracticeState(practice).phase).toStrictEqual({ kind: "reading" });
  });

  it("has nothing to play without mistakes", () => {
    expect(createPracticeState([]).phase).toStrictEqual({ kind: "ended", summary: null });
  });
});

describe(practiceReducer, () => {
  it("keeps every answer's id and each fixed mistake once, then moves on", () => {
    const practice = [
      entry("gap", { kind: "reteach", lesson: LESSON }),
      entry("misread", { kind: "readCarefully" }, 1),
    ];

    const reduce = practiceReducer;
    const answer = { selectedIndex: 0 };

    const played = [
      { type: "start" },
      { answer, timedOut: false, type: "check" },
      { feedback: graded("a1", true), mistakeId: "gap", type: "answered" },
      { type: "next" },
      { answer, timedOut: false, type: "check" },
      { feedback: graded("a2", true), mistakeId: "gap", type: "answered" },
      { type: "next" },
    ] as const;

    const state = played.reduce(
      (current, action) => reduce(current, action),
      createPracticeState(practice),
    );

    expect(state).toMatchObject({
      answerIds: ["a1", "a2"],
      fixedIds: ["gap"],
      index: 2,
      phase: { kind: "reading" },
    });

    expect(reduce(reduce(state, { type: "reveal" }), { type: "next" }).phase).toStrictEqual({
      kind: "ending",
    });
  });

  it("counts other notebook entries fixed by overlapping drills", () => {
    const initial = createPracticeState([entry("first"), entry("other")]);

    const checked = practiceReducer(initial, {
      answer: { selectedIndex: 0 },
      timedOut: false,
      type: "check",
    });

    const state = practiceReducer(checked, {
      feedback: { ...graded("a1", true), fixedMistakeIds: ["first", "other"] },
      mistakeId: "first",
      type: "answered",
    });

    const unknown = practiceReducer(practiceReducer(state, { type: "next" }), {
      answer: { dontKnow: true },
      timedOut: false,
      type: "check",
    });

    const reopened = practiceReducer(unknown, {
      feedback: { ...graded("a2"), fixedMistakeIds: [], isCorrect: false },
      mistakeId: "first",
      type: "answered",
    });

    expect(reopened.fixedIds).toStrictEqual(["other"]);
  });

  it("removes a correction from the run count if the entry returns to the notebook", () => {
    const initial = createPracticeState([entry("trap")]);

    const checked = practiceReducer(initial, {
      answer: { selectedIndex: 0 },
      timedOut: false,
      type: "check",
    });

    const fixed = practiceReducer(checked, {
      feedback: graded("a1", true),
      mistakeId: "trap",
      type: "answered",
    });

    const checkedUnknown = practiceReducer(practiceReducer(fixed, { type: "next" }), {
      answer: { dontKnow: true },
      timedOut: false,
      type: "check",
    });

    const unknown = practiceReducer(checkedUnknown, {
      feedback: { ...graded("a2"), isCorrect: false },
      mistakeId: "trap",
      type: "answered",
    });

    expect(unknown.fixedIds).toStrictEqual([]);
    expect(unknown.answerIds).toStrictEqual(["a1", "a2"]);
  });

  it("celebrates at its end what every count of the run reached, not only the last", () => {
    const answer = { selectedIndex: 0 };

    const played = [
      { answer, timedOut: false, type: "check" },
      {
        feedback: { ...graded("a1"), reached: { energy: 60, level: null } },
        mistakeId: "first",
        type: "answered",
      },
      { type: "next" },
      { answer, timedOut: false, type: "check" },
      {
        feedback: {
          ...graded("a2"),
          reached: { energy: null, level: { color: "yellow", level: 1 } },
        },
        mistakeId: "first",
        type: "answered",
      },
      { type: "end" },
      { summary: SUMMARY, type: "ended" },
    ] as const;

    const state = played.reduce(
      (current, action) => practiceReducer(current, action),
      createPracticeState([entry("first")]),
    );

    expect(state.reached).toStrictEqual({ energy: 60, level: { color: "yellow", level: 1 } });
  });

  it("keeps the answer to check again when grading fails", () => {
    const practice = [entry("time", { kind: "timed", timeLimitSeconds: 45 })];
    const reduce = practiceReducer;

    const checking = reduce(createPracticeState(practice), {
      answer: { dontKnow: true },
      timedOut: true,
      type: "check",
    });

    expect(reduce(checking, { type: "answerFailed" }).phase).toStrictEqual({
      answer: { dontKnow: true },
      kind: "answerFailed",
      timedOut: true,
    });
  });
});

describe(getPracticeSegments, () => {
  it("marks each answered question right or wrong, then the one in view and the ones ahead", () => {
    const practice = [entry("retry"), entry("guess", { kind: "noGuessing" }, 1)];
    const answer = { selectedIndex: 0 };

    const played = [
      { answer, timedOut: false, type: "check" },
      { feedback: graded("a1"), mistakeId: "retry", type: "answered" },
      { type: "next" },
      { answer: { selectedIndex: 1 }, timedOut: false, type: "check" },
      { feedback: { ...graded("a2"), isCorrect: false }, mistakeId: "retry", type: "answered" },
      { type: "next" },
    ] as const;

    const states = played.map((_, count) =>
      played
        .slice(0, count + 1)
        .reduce(
          (current, action) => practiceReducer(current, action),
          createPracticeState(practice),
        ),
    );

    expect(getPracticeSegments(createPracticeState(practice))).toStrictEqual([
      "current",
      "ahead",
      "ahead",
    ]);

    expect(getPracticeSegments(states[1]!)).toStrictEqual(["right", "ahead", "ahead"]);
    expect(getPracticeSegments(states[2]!)).toStrictEqual(["right", "current", "ahead"]);
    expect(getPracticeSegments(states[5]!)).toStrictEqual(["right", "wrong", "current"]);
  });

  it.each([
    { segment: "read", timedOut: false },
    { segment: "wrong", timedOut: true },
  ] as const)(
    "marks an unknown answer $segment when timedOut is $timedOut",
    ({ segment, timedOut }) => {
      const initial = createPracticeState([entry("gap")]);

      const checking = practiceReducer(initial, {
        answer: { dontKnow: true },
        timedOut,
        type: "check",
      });

      const answered = practiceReducer(checking, {
        feedback: { ...graded("unknown"), isCorrect: false },
        mistakeId: "gap",
        type: "answered",
      });

      expect(getPracticeSegments(answered)).toStrictEqual([segment, "ahead"]);

      expect(getPracticeSegments(practiceReducer(answered, { type: "next" }))).toStrictEqual([
        segment,
        "current",
      ]);
    },
  );
});

describe(isMistakeQuestion, () => {
  const mistake = entry("lesson");

  function stepOn(question: { context: string | null; question: string }, saved: string) {
    return {
      entry: { ...mistake, snapshot: { ...mistake.snapshot, question: saved } },
      firstOfEntry: true,
      question: { ...mistake.questions[0]!, ...question },
    };
  }

  it("knows a bank question saved as it's asked", () => {
    expect(isMistakeQuestion(stepOn({ context: null, question: "How much?" }, "How much?"))).toBe(
      true,
    );
  });

  it("knows a lesson's question saved with its context before it, on any line break", () => {
    const question = { context: "A shirt costs R$ 120.", question: "How much?" };

    expect(isMistakeQuestion(stepOn(question, "A shirt costs R$ 120.\n\nHow much?"))).toBe(true);
    expect(isMistakeQuestion(stepOn(question, "A shirt costs R$ 120. How much?"))).toBe(true);
  });

  it("tells another question on the same skill apart", () => {
    expect(
      isMistakeQuestion(
        stepOn(
          { context: "A bike costs R$ 250.", question: "How much?" },
          "A shirt costs R$ 120.\n\nHow much?",
        ),
      ),
    ).toBe(false);
  });
});
