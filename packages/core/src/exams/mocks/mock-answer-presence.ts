import { type MockAnswer } from "./mock-answer-contract";

/** A pick, a number (including zero), or text that the learner hasn't cleared. */
export function isMockAnswerPresent(answer: MockAnswer | null | undefined): boolean {
  return (
    answer !== null &&
    answer !== undefined &&
    (!("text" in answer) || answer.text.trim().length > 0)
  );
}
