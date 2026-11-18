import { isMockAnswerPresent } from "@zoonk/core/exams/mocks/answer-presence";
import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";
import { type MockRunner } from "./mock-context";

export function isDraftAnswered(draft: MockDraft | undefined): boolean {
  return isMockAnswerPresent(draft?.answer);
}

export function countsTowardMockProgress(
  {
    drafts,
    failedDrafts,
    savedDrafts,
  }: Pick<MockRunner, "drafts" | "failedDrafts" | "savedDrafts">,
  itemId: string,
): boolean {
  const draft = drafts[itemId];
  const failed = failedDrafts[itemId];
  const saved = savedDrafts[itemId];

  return (
    isDraftAnswered(draft) && (draft?.answer !== failed?.answer || draft?.answer === saved?.answer)
  );
}
