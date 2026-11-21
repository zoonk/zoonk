import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";

type Placed = Pick<MockQuestion, "format">;

/** Written questions sit apart from an objective section's count, unless the section is all written (a written test). */
function isCounted(question: Placed, questions: readonly Placed[]): boolean {
  return question.format !== "essay" || questions.every(({ format }) => format === "essay");
}

export function getSectionPlace({
  position,
  questions,
}: {
  position: number;
  questions: readonly Placed[];
}): { number: number; total: number } | null {
  const question = questions[position];

  if (!question || !isCounted(question, questions)) {
    return null;
  }

  return {
    number: questions.slice(0, position + 1).filter((other) => isCounted(other, questions)).length,
    total: questions.filter((other) => isCounted(other, questions)).length,
  };
}
