/** About how wide one character of a 12px label is, to keep category labels from overlapping. */
const LABEL_CHAR_WIDTH = 6.6;
const LABEL_GAP = 6;
const MAX_LINES_UNDER_BAR = 2;

export type CategoryLabelLayout = { lines: string[][]; step: number };

export function getLabelWidth(text: string): number {
  return text.length * LABEL_CHAR_WIDTH + LABEL_GAP;
}

function splitWords(label: string): string[] {
  return label.split(/(?<=[\s-])/u);
}

function breakWord({ room, word }: { room: number; word: string }): string[] {
  const pieces = [""];

  for (const character of word) {
    const piece = `${pieces.at(-1)}${character}`;

    if (pieces.at(-1) === "" || getLabelWidth(piece.trim()) <= room) {
      pieces[pieces.length - 1] = piece;
    } else {
      pieces.push(character);
    }
  }

  return pieces;
}

/** Wraps at spaces and hyphens; only a word wider than the whole room breaks between letters. */
export function wrapLabel({ label, room }: { label: string; room: number }): string[] {
  const lines = [""];
  const words = splitWords(label).flatMap((word) => breakWord({ room, word }));

  for (const word of words) {
    const line = `${lines.at(-1)}${word}`;

    if (getLabelWidth(line.trim()) <= room) {
      lines[lines.length - 1] = line;
    } else {
      lines.push(word);
    }
  }

  return lines.map((line) => line.trim()).filter(Boolean);
}

/**
 * Each name wraps at a space or hyphen to fit under its bar. A word wider than a bar can't, so only
 * every few names show, each with the room of the ones it skips: fine for a line chart's ordered
 * axis, while a bar chart whose names don't fit lies on its side instead (`fitsUnderBars`).
 */
export function getCategoryLabels({
  band,
  categories,
}: {
  band: number;
  categories: readonly string[];
}): CategoryLabelLayout {
  const widestWord = Math.max(
    ...categories.flatMap((category) =>
      splitWords(category).map((word) => getLabelWidth(word.trim())),
    ),
  );

  const step = Math.min(Math.max(Math.ceil(widestWord / band), 1), categories.length);

  return { lines: categories.map((label) => wrapLabel({ label, room: band * step })), step };
}

export function fitsUnderBars({ lines, step }: CategoryLabelLayout): boolean {
  return step === 1 && lines.every((name) => name.length <= MAX_LINES_UNDER_BAR);
}

export function clampLabelCenter({
  lines,
  width,
  x,
}: {
  lines: string[];
  width: number;
  x: number;
}): number {
  const half = Math.max(...lines.map((line) => getLabelWidth(line))) / 2;
  return Math.min(Math.max(x, half), width - half);
}
