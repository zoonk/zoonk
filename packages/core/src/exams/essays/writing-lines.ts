export const WRITING_LINE_BREAK = /\r\n|[\r\n\u2028\u2029]/u;
const LINE_BREAKS = new RegExp(WRITING_LINE_BREAK.source, "gu");
const BLANK = /^\p{White_Space}*$/u;
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// Median of 38 published handwritten answers from CACD 2024–2025 and Inep’s 2020 booklet.
export const WRITING_CHARACTERS_PER_LINE = 87;

// The densest answers the CACD 2024 guide records as read in full fit about 133 characters a
// line on their sheet, one written small on purpose to fit (#3265).
const DENSEST_CHARACTERS_PER_LINE = 135;

/** The densest real handwriting on a sheet whose typical hand fits `charactersPerLine`. */
export function getDenseCharactersPerLine(charactersPerLine: number) {
  return Math.round(
    (charactersPerLine * DENSEST_CHARACTERS_PER_LINE) / WRITING_CHARACTERS_PER_LINE,
  );
}

/**
 * The sheet lines a text takes at `charactersPerLine`, and the UTF-16 offset of its first
 * grapheme past line `limit`. A line break starts a line, and a blank line takes none, since a
 * handwritten sheet skips no line between paragraphs.
 */
function layOutLines({
  charactersPerLine,
  limit,
  text,
}: {
  charactersPerLine: number;
  limit: number | null;
  text: string;
}) {
  let lines = 0;
  let pastLimitFrom: number | null = null;
  let start = 0;

  const ends = [...text.matchAll(LINE_BREAKS), { 0: "", index: text.length }];

  for (const { 0: lineBreak, index: end } of ends) {
    const line = text.slice(start, end);

    if (!BLANK.test(line)) {
      let position = 0;

      for (const { index } of GRAPHEMES.segment(line)) {
        if (limit !== null && lines + Math.floor(position / charactersPerLine) >= limit) {
          pastLimitFrom ??= start + index;
        }

        position += 1;
      }

      lines += Math.ceil(position / charactersPerLine);
    }

    start = end + lineBreak.length;
  }

  return { lines, pastLimitFrom };
}

export function estimateWritingLines({
  charactersPerLine,
  text,
}: {
  charactersPerLine: number;
  text: string;
}) {
  return layOutLines({ charactersPerLine, limit: null, text }).lines;
}

/**
 * `estimatedLines` counts the text at a typical hand. Graders read up to `ignoredFrom`, where it
 * would pass the limit even at `denseCharactersPerLine`, so no answer that fits the sheet in real
 * handwriting loses its end.
 */
export function countWritingLines({
  charactersPerLine,
  denseCharactersPerLine,
  limit,
  text,
}: {
  charactersPerLine: number;
  denseCharactersPerLine: number;
  limit: number | null;
  text: string;
}) {
  return {
    estimatedLines: estimateWritingLines({ charactersPerLine, text }),
    ignoredFrom: layOutLines({ charactersPerLine: denseCharactersPerLine, limit, text })
      .pastLimitFrom,
  };
}
