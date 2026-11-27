export const WRITING_LINE_BREAK = /\r\n|[\r\n\u2028\u2029]/u;
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// Median of 38 published handwritten answers from CACD 2024–2025 and Inep’s 2020 booklet.
export const WRITING_CHARACTERS_PER_LINE = 87;

// The densest hand a board read in full: every CACD 2024–2025 answer in the candidate guides fits
// its sheet's limit at this width (the densest needs 159), so a typed answer is cut only where no
// published hand could have fit it.
export const WRITING_MAX_CHARACTERS_PER_LINE = 160;

const SPACE = /^\p{White_Space}+$/u;

// A paragraph starts on the next line of the sheet, none is left blank between paragraphs, and a
// space never starts a line, so only text opens one. The text past the limit starts at a word.
function countLines(text: string, charactersPerLine: number, limit: number | null) {
  let lines = 0;
  let passedFrom: number | null = null;
  let used = 0;
  let broken = false;
  let wordStart = 0;

  for (const { index, segment } of GRAPHEMES.segment(text)) {
    const space = SPACE.test(segment);

    if (WRITING_LINE_BREAK.test(segment)) {
      broken = lines > 0;
    } else if (!space) {
      if (lines === 0 || broken || used === charactersPerLine) {
        lines += 1;
        used = 0;
        broken = false;
      }

      if (limit !== null && lines > limit) {
        passedFrom ??= wordStart;
      }

      used += 1;
    } else if (lines > 0 && !broken && used < charactersPerLine) {
      used += 1;
    }

    if (space) {
      wordStart = index + segment.length;
    }
  }

  return { lines, passedFrom };
}

/** How many lines of the sheet the text would take at a typical hand. */
export function estimateWritingLines({
  charactersPerLine,
  text,
}: {
  charactersPerLine: number;
  text: string;
}) {
  return countLines(text, charactersPerLine, null).lines;
}

/**
 * `estimatedLines` counts at a typical hand (`charactersPerLine`), so the learner sees how much
 * of the sheet an answer would take; `ignoredFrom` is where the text passes `limit` even at the
 * densest published hand (`maxCharactersPerLine`), the part no grader would read.
 */
export function countWritingLines({
  charactersPerLine,
  limit,
  maxCharactersPerLine,
  text,
}: {
  charactersPerLine: number;
  limit: number | null;
  maxCharactersPerLine: number;
  text: string;
}) {
  return {
    estimatedLines: estimateWritingLines({ charactersPerLine, text }),
    ignoredFrom: countLines(text, maxCharactersPerLine, limit).passedFrom,
  };
}
