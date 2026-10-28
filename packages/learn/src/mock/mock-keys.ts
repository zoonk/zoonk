import { type MockScoring } from "@zoonk/core/exams/mocks/contract";
import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";

export const FLAG_KEY = "f";

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
