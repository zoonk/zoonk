import { type PageWords } from "./words.mts";

export function pageTopComparisons(loads: { path: string; viewport: string; words: PageWords }[]) {
  const pages = loads.filter(({ words }) => words.kind !== "marketing" && words.titleTop !== null);

  // A bar that holds nothing gives its row to the title, so those titles compare with each other.
  return [
    ...Map.groupBy(pages, ({ viewport, words }) => `${viewport} ${words.titleTop?.bare}`),
  ].flatMap(([, group]) => {
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
                message: `the title starts ${actual} px below its frame; the most common start across this screen's pages with a bar like it is ${common} px`,
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
