const HARDER_MODULE_SHARE = 0.6;

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
