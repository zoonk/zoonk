type PlayerResourceStep = { chapterSentenceId: string | null; chapterWordId: string | null };

/**
 * Resource IDs should stay stable and unique in the same order the caller
 * discovered them. That keeps review payloads deterministic while avoiding
 * duplicate resource queries when several replayed steps use the same row.
 */
function deduplicateIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

/**
 * Language resource IDs are nullable because many step kinds do not use them.
 * Returning a list here keeps the public helper's pipeline flat without
 * leaking nullable values into query parameters.
 */
function getChapterWordId(step: PlayerResourceStep): string[] {
  return step.chapterWordId ? [step.chapterWordId] : [];
}

/**
 * Sentence resources are only present for reading/listening steps, so static
 * and choice-based steps should not affect the sentence resource query.
 */
function getChapterSentenceId(step: PlayerResourceStep): string[] {
  return step.chapterSentenceId ? [step.chapterSentenceId] : [];
}

/**
 * Returns the resource IDs that own the language metadata required by the
 * player payload. Translation, listening, and review lessons no longer need
 * source-lesson inference because generation copies these IDs onto each step.
 */
export function getPlayerResourceIds({ steps }: { steps: PlayerResourceStep[] }): {
  chapterSentenceIds: string[];
  chapterWordIds: string[];
} {
  return {
    chapterSentenceIds: deduplicateIds(steps.flatMap((step) => getChapterSentenceId(step))),
    chapterWordIds: deduplicateIds(steps.flatMap((step) => getChapterWordId(step))),
  };
}
