/** A run's answers so far, kept on the device until the run is finished and graded. */
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
  try {
    const raw = globalThis.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isDraft<TAnswer>(parsed) ? parsed.answers : [];
  } catch {
    return [];
  }
}

export function writeAnswerDraft<TAnswer extends { itemId: string }>({
  answers,
  key,
}: {
  answers: TAnswer[];
  key: string;
}) {
  try {
    globalThis.localStorage.setItem(key, JSON.stringify({ answers }));
  } catch {
    // Without storage the run still works; a reload just starts it over.
  }
}

export function clearAnswerDraft(key: string) {
  try {
    globalThis.localStorage.removeItem(key);
  } catch {
    // Nothing to clear without storage.
  }
}

/**
 * The saved answers that still fit the run: the ones to its questions in the same order, from the
 * first, short of the last question, so a reload while the answers were being graded asks the
 * last one again instead of finishing on its own.
 */
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
