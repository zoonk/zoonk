/** A subject of the exam with its right answers in each mock, as a share in percent. */
type SubjectTrend = { name: string; percents: readonly number[] };

/**
 * The subject whose latest mock went best, for the exam page's second number. "Best" has to beat
 * the others: with one subject, or the top share tied (Linguagens and Ciências Humanas both 70%),
 * there's no best area to name, and the page says nothing rather than pick one.
 */
export function findBestArea(
  subjects: readonly SubjectTrend[],
): { name: string; percent: number } | null {
  const latest = subjects.flatMap(({ name, percents }) => {
    const percent = percents.at(-1);
    return percent === undefined ? [] : [{ name, percent }];
  });

  const [best, next] = latest.toSorted((a, b) => b.percent - a.percent);

  if (!best || !next || next.percent === best.percent) {
    return null;
  }

  return best;
}
