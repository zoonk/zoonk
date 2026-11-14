import { type PageWords } from "./words.mts";

export function pageTopComparisons(loads: { path: string; viewport: string; words: PageWords }[]) {
  const pages = loads.filter(({ words }) => words.kind !== "marketing" && words.titleTop !== null);

  return [...Map.groupBy(pages, ({ viewport }) => viewport)].flatMap(([, group]) => {
    const offsets = group.map(({ words }) => words.titleTop?.actual ?? 0);

    const common = [...Map.groupBy(offsets, (offset) => Math.round(offset))].toSorted(
      (a, b) => b[1].length - a[1].length,
    )[0]?.[0];

    return group.flatMap(({ path, viewport, words }) => {
      const actual = words.titleTop?.actual;

      return actual !== undefined && common !== undefined && Math.abs(actual - common) > 1
        ? [
            {
              finding: {
                check: "E8 page tops across pages",
                level: "warn" as const,
                message: `the title starts ${actual} px below its frame; the most common start across this screen's pages is ${common} px`,
                unit: "px",
                value: actual - common,
              },
              path,
              viewport,
            },
          ]
        : [];
    });
  });
}
