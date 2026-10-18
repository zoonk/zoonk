/**
 * Adaptive exams like the digital SAT route the second module by how the first went: a strong
 * first module leads to harder questions, which can reach higher scores. The College Board doesn't
 * publish its cut, so this uses a share of right answers that separates the two groups well.
 */
const HARDER_MODULE_SHARE = 0.6;

/** The questions of the next module, picked by the share of right answers in the one before. */
export function routeNextModule({
  correct,
  questions,
  routing,
  total,
}: {
  correct: number;
  questions: number;
  routing: { easier: readonly string[]; harder: readonly string[] };
  total: number;
}): string[] {
  const next = total > 0 && correct / total >= HARDER_MODULE_SHARE ? "harder" : "easier";
  return routing[next].slice(0, questions);
}
