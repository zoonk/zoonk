import { describe, expect, it } from "vitest";
import { examFormat, examStructure } from "./_test-utils/exam-formats";
import { allowsTypedQuestions, asksWrittenAnswers } from "./written-answers";

const examGoal = { details: {}, kind: "exam" as const, targetLanguage: null };
const hobbyGoal = { details: {}, kind: "learn" as const, targetLanguage: null };

describe(asksWrittenAnswers, () => {
  it("asks written answers for an exam with discursive questions or short written answers", () => {
    expect(asksWrittenAnswers(examStructure(["multipleChoice", "essay"]))).toBe(true);
    expect(asksWrittenAnswers(examStructure(["trueFalse", "shortAnswer"]))).toBe(true);
  });

  it("asks none for an exam of choices, statements and numbers, or a goal without an exam", () => {
    expect(asksWrittenAnswers(examStructure(["multipleChoice", "trueFalse", "numeric"]))).toBe(
      false,
    );

    expect(asksWrittenAnswers(null)).toBe(false);
  });
});

describe(allowsTypedQuestions, () => {
  it("asks typed questions only of a goal whose exam asks written answers, or a language's", () => {
    const essay = examStructure(["essay"]);
    const choices = examStructure(["multipleChoice"]);

    expect(allowsTypedQuestions({ goal: examGoal, structure: essay })).toBe(true);
    expect(allowsTypedQuestions({ goal: examGoal, structure: choices })).toBe(false);
    expect(allowsTypedQuestions({ goal: hobbyGoal, structure: null })).toBe(false);

    expect(
      allowsTypedQuestions({
        goal: { ...hobbyGoal, kind: "language", targetLanguage: "en" },
        structure: null,
      }),
    ).toBe(true);
  });

  it("reads an exam goal's notice formats until its blueprint is linked, and then the blueprint's", () => {
    const goal = { ...examGoal, details: { noticeFormats: [examFormat("shortAnswer")] } };

    expect(allowsTypedQuestions({ goal, structure: null })).toBe(true);

    expect(allowsTypedQuestions({ goal, structure: examStructure(["multipleChoice"]) })).toBe(
      false,
    );

    // Only research on an exam's notice keeps its formats on a goal.
    expect(allowsTypedQuestions({ goal: { ...goal, kind: "learn" }, structure: null })).toBe(false);
  });
});
