export const WRITING_LINE_BREAK = /\r\n|[\r\n\u2028\u2029]/u;
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export const WRITING_CHARACTERS_PER_LINE = 55;

export function countWritingLines({
  charactersPerLine,
  limit,
  text,
}: {
  charactersPerLine: number;
  limit: number | null;
  text: string;
}) {
  let estimatedLines = 0;
  let ignoredFrom: number | null = null;
  let used = 0;

  for (const { index, segment } of GRAPHEMES.segment(text)) {
    const lineBreak = WRITING_LINE_BREAK.test(segment);

    if (estimatedLines === 0 || (used === charactersPerLine && !lineBreak)) {
      estimatedLines += 1;
      used = 0;
    }

    if (limit !== null && estimatedLines > limit) {
      ignoredFrom ??= index;
    }

    if (lineBreak) {
      estimatedLines += 1;
      used = 0;
    } else {
      used += 1;
    }
  }

  return { estimatedLines, ignoredFrom };
}
