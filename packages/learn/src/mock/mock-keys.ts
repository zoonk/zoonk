import { type MockScoring } from "@zoonk/core/exams/mocks/contract";
import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";

/** The key that flags the question on screen, as the Flag button's keycap shows it. */
export const FLAG_KEY = "f";

/**
 * How a question's options are marked: numbers (1, 2, 3…), the keys that pick them, or glyphs for
 * a statement judged right, wrong or left blank where a wrong answer cancels a right one
 * (Cebraspe's exams); none for an answer typed in a box.
 */
export function getOptionMarks({
  format,
  scoring,
}: {
  format: MockQuestion["format"];
  scoring: MockScoring;
}): "glyphs" | "numbers" | null {
  if (format === "multipleChoice") {
    return "numbers";
  }

  if (format === "trueFalse") {
    return scoring === "net" ? "glyphs" : "numbers";
  }

  return null;
}
