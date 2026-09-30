import { describe, expect, it } from "vitest";
import { type PlayableLibraryStep } from "./contract";
import { isAnswerableStep, tallyLessonRun } from "./lesson-run";

function step(id: string, kind: PlayableLibraryStep["kind"]) {
  return { id, kind };
}

const lesson = [
  step("hook", "hook"),
  step("idea", "explanation"),
  step("check-1", "check"),
  step("typed", "typedAnswer"),
  step("check-2", "check"),
  step("summary", "summary"),
];

describe(isAnswerableStep, () => {
  it("takes answers on checks, typed and spoken answers, activities and exercises", () => {
    const answerable = [
      "check",
      "typedAnswer",
      "spokenAnswer",
      "activity",
      "multipleChoice",
      "fillBlank",
    ] as const;

    const readOnly = ["hook", "explanation", "workedExample", "summary", "alphabet"] as const;

    expect(answerable.every((kind) => isAnswerableStep({ kind }))).toBe(true);
    expect(readOnly.some((kind) => isAnswerableStep({ kind }))).toBe(false);
  });
});

describe(tallyLessonRun, () => {
  it("is complete once every answerable screen has an answer, counting first answers only", () => {
    const tally = tallyLessonRun({
      attempts: [
        { isCorrect: false, stepId: "check-1" },
        { isCorrect: true, stepId: "typed" },
        { isCorrect: true, stepId: "check-2" },
        { isCorrect: true, stepId: "check-1" },
      ],
      steps: lesson,
    });

    expect(tally).toStrictEqual({ correctCount: 2, incorrectCount: 1, isComplete: true });
  });

  it("isn't complete while a screen is unanswered", () => {
    const tally = tallyLessonRun({
      attempts: [
        { isCorrect: true, stepId: "check-1" },
        { isCorrect: false, stepId: "check-2" },
      ],
      steps: lesson,
    });

    expect(tally.isComplete).toBe(false);
  });

  it('is complete when "I know this" got every check right, skipping the rest', () => {
    const tally = tallyLessonRun({
      attempts: [
        { isCorrect: true, stepId: "check-1" },
        { isCorrect: true, stepId: "check-2" },
      ],
      steps: lesson,
    });

    expect(tally).toStrictEqual({ correctCount: 2, incorrectCount: 0, isComplete: true });
  });

  it("ignores answers to screens outside the lesson and answers without a screen", () => {
    const tally = tallyLessonRun({
      attempts: [
        { isCorrect: true, stepId: "elsewhere" },
        { isCorrect: true, stepId: null },
        { isCorrect: true, stepId: "hook" },
      ],
      steps: lesson,
    });

    expect(tally).toStrictEqual({ correctCount: 0, incorrectCount: 0, isComplete: false });
  });

  it("completes a lesson with nothing to answer", () => {
    const tally = tallyLessonRun({
      attempts: [],
      steps: [step("idea", "explanation"), step("summary", "summary")],
    });

    expect(tally).toStrictEqual({ correctCount: 0, incorrectCount: 0, isComplete: true });
  });
});
