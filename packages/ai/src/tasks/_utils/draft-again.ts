import { safeAsync } from "@zoonk/utils/error";

/**
 * Keeps the draft with fewer problems, the first on a tie or when the second call fails. At most
 * one more call, so a flaw no draft avoids costs one call, not a loop.
 */
export async function draftAgainWhenFlawed<T>({
  countProblems,
  draft,
}: {
  countProblems: (output: T) => number;
  draft: (previous: T | null) => Promise<T>;
}): Promise<T> {
  const first = await draft(null);
  const problems = countProblems(first);

  if (problems === 0) {
    return first;
  }

  const second = await safeAsync(() => draft(first));

  return second.data !== null && countProblems(second.data) < problems ? second.data : first;
}
