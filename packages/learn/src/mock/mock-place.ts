import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";

function isCounted(question: Pick<MockQuestion, "format">): boolean {
  return question.format !== "essay";
}

export function getSectionPlace({
  position,
  questions,
}: {
  position: number;
  questions: readonly Pick<MockQuestion, "format">[];
}): { number: number; total: number } | null {
  const question = questions[position];

  if (!question || !isCounted(question)) {
    return null;
  }

  return {
    number: questions.slice(0, position + 1).filter((other) => isCounted(other)).length,
    total: questions.filter((other) => isCounted(other)).length,
  };
}
