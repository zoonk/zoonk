import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";

function isCounted(question: Pick<MockQuestion, "format">): boolean {
  return question.format !== "essay";
}

/**
 * Where the question on screen sits in its section, as the line under the header counts it, with
 * the same denominator as the bar over it: its place among the section's questions and how many
 * there are. A written part's essays are named, not counted (null for an essay). The question's
 * own number, the mock's, is the answer sheet's.
 */
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
