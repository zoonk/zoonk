import { type ItemExamFormat } from "./generate-items";

export function formatPastQuestions(examFormat: ItemExamFormat | null | undefined): string {
  const questions = examFormat?.pastQuestions ?? [];

  if (questions.length === 0) {
    return "";
  }

  const lines = questions.map(
    (question, index) => `    ${index + 1}. ${question.replaceAll(/\s+/gu, " ").trim()}`,
  );

  return `\n    PAST_QUESTIONS:\n${lines.join("\n")}`;
}
