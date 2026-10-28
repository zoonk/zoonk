import { deviceStorage } from "../../_utils/device-storage";

type AnswerDraft<TAnswer extends { itemId: string }> = { answers: TAnswer[] };

function isDraft<TAnswer extends { itemId: string }>(
  value: unknown,
): value is AnswerDraft<TAnswer> {
  return (
    typeof value === "object" &&
    value !== null &&
    "answers" in value &&
    Array.isArray(value.answers)
  );
}

export function readAnswerDraft<TAnswer extends { itemId: string }>(key: string): TAnswer[] {
  const draft = deviceStorage.getJson(key);
  return isDraft<TAnswer>(draft) ? draft.answers : [];
}

export function writeAnswerDraft<TAnswer extends { itemId: string }>({
  answers,
  key,
}: {
  answers: TAnswer[];
  key: string;
}) {
  deviceStorage.set(key, JSON.stringify({ answers }));
}

function getRequestIdKey(key: string): string {
  return `${key}:requestId`;
}

/** Kept until the draft is cleared, so a reload after a send whose response never came sends the same id and the run counts once. `fallback` is used when none is kept, and without storage. */
export function keepDraftRequestId({ fallback, key }: { fallback: string; key: string }): string {
  const kept = deviceStorage.get(getRequestIdKey(key));

  if (kept) {
    return kept;
  }

  deviceStorage.set(getRequestIdKey(key), fallback);
  return fallback;
}

export function clearAnswerDraft(key: string) {
  deviceStorage.remove(key);
  deviceStorage.remove(getRequestIdKey(key));
}

/** Stops short of the last question, so a reload while the answers were graded asks it again instead of finishing on its own. */
export function getResumableAnswers<TAnswer extends { itemId: string }>({
  answers,
  questionIds,
  total,
}: {
  answers: readonly TAnswer[];
  questionIds: readonly string[];
  total: number;
}): TAnswer[] {
  const matching = answers.findIndex((answer, index) => answer.itemId !== questionIds[index]);
  const prefix = matching === -1 ? answers : answers.slice(0, matching);

  return prefix.slice(0, Math.max(0, total - 1));
}
