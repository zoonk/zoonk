import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";
import { MS_PER_SECOND } from "@zoonk/utils/date";

export function isSavedQuestionExpired({
  drafts,
  itemId,
  seconds,
}: {
  drafts: readonly Pick<MockDraft, "durationMs" | "itemId">[];
  itemId?: string;
  seconds: number | null;
}): boolean {
  if (!itemId || seconds === null) {
    return false;
  }

  const durationMs = drafts.find((draft) => draft.itemId === itemId)?.durationMs ?? 0;
  return durationMs >= seconds * MS_PER_SECOND;
}
