type SubjectTrend = { name: string; percents: readonly number[] };

/** None with one subject or a tie at the top: the page says nothing rather than pick one. */
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
