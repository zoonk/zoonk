import { type MockAnswer } from "./mock-answer-contract";

export function isMockAnswerPresent(answer: MockAnswer | null | undefined): boolean {
  return (
    answer !== null &&
    answer !== undefined &&
    (!("text" in answer) || answer.text.trim().length > 0)
  );
}
