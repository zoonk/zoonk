/**
 * Learners' pace per answer estimates a mock made only of questions. A written part the mock asks,
 * or a section without questions (a speaking task), takes its own time, which no answer pace
 * measures, so such a mock's estimate is its time limit. A written part it leaves out doesn't count.
 */
export function estimateMockMinutes({
  minutes,
  pace,
  questions,
  sections,
  written,
}: {
  minutes: number;
  pace: number | null;
  questions: number;
  sections: readonly { questions: number | null }[];
  written: readonly { asked: boolean }[];
}): number {
  const onlyQuestions =
    !written.some((part) => part.asked) &&
    sections.every((section) => (section.questions ?? 0) > 0);

  return pace === null || !onlyQuestions
    ? minutes
    : Math.min(minutes, Math.max(1, Math.round(questions * pace)));
}
