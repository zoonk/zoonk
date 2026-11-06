import { safeAsync } from "@zoonk/utils/error";
import { type TaskProvenance } from "../../provenance/task-provenance";

type Draft = { provenance: TaskProvenance; setAside?: readonly TaskProvenance[] };

function keepDraft<T extends Draft>(
  kept: T,
  dropped: readonly T[],
): T & { setAside: TaskProvenance[] } {
  return {
    ...kept,
    setAside: [
      ...(kept.setAside ?? []),
      ...dropped.flatMap((draft) => [...(draft.setAside ?? []), draft.provenance]),
    ],
  };
}

/**
 * Keeps the draft with fewer problems, the first on a tie or when the second call fails. At most
 * one more call, so a flaw no draft avoids costs one call, not a loop. `setAside` lists the calls
 * behind every draft it didn't keep, so evals count what they cost.
 */
export async function draftAgainWhenFlawed<T extends Draft>({
  countProblems,
  draft,
}: {
  countProblems: (output: T) => number;
  draft: (previous: T | null) => Promise<T>;
}): Promise<T & { setAside: TaskProvenance[] }> {
  const first = await draft(null);
  const problems = countProblems(first);

  if (problems === 0) {
    return keepDraft(first, []);
  }

  const second = await safeAsync(() => draft(first));

  if (second.data === null) {
    return keepDraft(first, []);
  }

  return countProblems(second.data) < problems
    ? keepDraft(second.data, [first])
    : keepDraft(first, [second.data]);
}
