/**
 * Learners' pace per answer estimates a mock made only of questions. A written or spoken part
 * takes its own time, which no answer pace measures, so such a mock's estimate is its time limit.
 */
export function estimateMockMinutes({
  minutes,
  onlyQuestions,
  pace,
  questions,
}: {
  minutes: number;
  onlyQuestions: boolean;
  pace: number | null;
  questions: number;
}): number {
  return pace === null || !onlyQuestions
    ? minutes
    : Math.min(minutes, Math.max(1, Math.round(questions * pace)));
}
