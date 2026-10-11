import { safeAsync } from "@zoonk/utils/error";

/**
 * A generation whose output code finds flawed (a lesson plan with four teaching screens in a row, a
 * skill graph chained in a textbook's order) is written once more, and the output with fewer
 * problems is kept: the first one on a tie or when the second call fails, since it's still the
 * best there is. At most one more call, so a flaw no draft avoids costs one call, not a loop. The
 * second draft gets the first (`previous`), so it can be told what to avoid.
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
