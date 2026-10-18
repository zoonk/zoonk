import { type MockScoring } from "@zoonk/core/exams/mocks/contract";
import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";

/** The key that flags the question on screen, as the Flag button's keycap shows it. */
export const FLAG_KEY = "f";

/** F is the sixth of the answer sheet's letters (A to I). */
const FLAG_LETTER_INDEX = 5;

/** A statement's two answers, true and false, lettered A and B where they're lettered. */
const STATEMENT_OPTIONS = 2;

/**
 * How a question's options are marked, as the exam's answer sheet marks them: letters (A, B, C…),
 * or glyphs for a statement judged right, wrong or left blank where a wrong answer cancels a right
 * one (Cebraspe's exams); none for an answer typed in a box.
 */
export function getOptionMarks({
  format,
  scoring,
}: {
  format: MockQuestion["format"];
  scoring: MockScoring;
}): "glyphs" | "letters" | null {
  if (format === "multipleChoice") {
    return "letters";
  }

  if (format === "trueFalse") {
    return scoring === "net" ? "glyphs" : "letters";
  }

  return null;
}

/** How many of a question's options answer to a letter key (and to its digit, 1 for A). */
export function countLetteredOptions({
  question,
  scoring,
}: {
  question: Pick<MockQuestion, "format" | "options">;
  scoring: MockScoring;
}): number {
  if (getOptionMarks({ format: question.format, scoring }) !== "letters") {
    return 0;
  }

  return question.format === "multipleChoice" ? (question.options?.length ?? 0) : STATEMENT_OPTIONS;
}

/**
 * Whether F can flag the question: on one with a sixth lettered option, F picks that option, as
 * its keycap says, and Flag is a tap.
 */
export function isFlagKeyFree(letteredOptions: number): boolean {
  return letteredOptions <= FLAG_LETTER_INDEX;
}
