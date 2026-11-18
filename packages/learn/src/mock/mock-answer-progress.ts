import { isMockAnswerPresent } from "@zoonk/core/exams/mocks/answer-presence";
import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";

export function isDraftAnswered(draft: MockDraft | undefined): boolean {
  return isMockAnswerPresent(draft?.answer);
}

export function isCountedMockAnswer({
  draft,
  failed,
  saved,
}: {
  draft?: MockDraft;
  failed?: MockDraft;
  saved?: MockDraft;
}): boolean {
  return (
    isDraftAnswered(draft) && (draft?.answer !== failed?.answer || draft?.answer === saved?.answer)
  );
}

export function countsTowardMockProgress(
  runner: {
    drafts: Readonly<Partial<Record<string, MockDraft>>>;
    failedDrafts: Readonly<Partial<Record<string, MockDraft>>>;
    savedDrafts: Readonly<Partial<Record<string, MockDraft>>>;
  },
  itemId: string,
): boolean {
  return isCountedMockAnswer({
    draft: runner.drafts[itemId],
    failed: runner.failedDrafts[itemId],
    saved: runner.savedDrafts[itemId],
  });
}
