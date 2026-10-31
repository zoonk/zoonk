import { describe, expect, it } from "vitest";
import { examFormat, examStructure } from "./_test-utils/exam-formats";
import { asksShortAnswers, practicesShortAnswers } from "./short-answers";

const examGoal = { details: {}, kind: "exam" as const, targetLanguage: null };
const hobbyGoal = { details: {}, kind: "learn" as const, targetLanguage: null };

describe(asksShortAnswers, () => {
  it("asks short written answers only for an exam whose formats include them", () => {
    expect(asksShortAnswers(examStructure(["trueFalse", "shortAnswer"]))).toBe(true);
    expect(asksShortAnswers(examStructure(["multipleChoice", "trueFalse", "numeric"]))).toBe(false);

    expect(asksShortAnswers(null)).toBe(false);
  });

  it("asks none for an exam of choices and an essay", () => {
    expect(asksShortAnswers(examStructure(["multipleChoice", "essay"]))).toBe(false);
  });
});

describe(practicesShortAnswers, () => {
  it("practices short typed answers only for an exam that asks them, or a language", () => {
    const shortAnswers = examStructure(["multipleChoice", "shortAnswer"]);
    const essay = examStructure(["multipleChoice", "essay"]);

    expect(practicesShortAnswers({ goal: examGoal, structure: shortAnswers })).toBe(true);
    expect(practicesShortAnswers({ goal: examGoal, structure: essay })).toBe(false);
    expect(practicesShortAnswers({ goal: hobbyGoal, structure: null })).toBe(false);

    expect(
      practicesShortAnswers({
        goal: { ...hobbyGoal, kind: "language", targetLanguage: "en" },
        structure: null,
      }),
    ).toBe(true);
  });

  it("reads an exam goal's notice formats until its blueprint is linked, and then the blueprint's", () => {
    const goal = { ...examGoal, details: { noticeFormats: [examFormat("shortAnswer")] } };

    expect(practicesShortAnswers({ goal, structure: null })).toBe(true);

    expect(practicesShortAnswers({ goal, structure: examStructure(["multipleChoice"]) })).toBe(
      false,
    );

    expect(practicesShortAnswers({ goal: { ...goal, kind: "learn" }, structure: null })).toBe(
      false,
    );
  });
});
