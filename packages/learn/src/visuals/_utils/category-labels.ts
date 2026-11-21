/** About how wide one character of a 12px Latin label is, where the chart's font can't be measured. */
const LABEL_CHAR_WIDTH = 6.6;
const LABEL_GAP = 6;
const MAX_LINES_UNDER_BAR = 2;

export type CategoryLabelLayout = { lines: string[][]; step: number };

/** A label's drawn width, without the gap after it; point names are drawn in medium weight. */
export type TextWidth = (text: string, weight?: "medium") => number;

export const estimateTextWidth: TextWidth = (text) => text.length * LABEL_CHAR_WIDTH;

/** The room a label takes: its drawn width and the gap that keeps it off its neighbor. */
export type LabelWidth = (text: string) => number;

export function toLabelWidth(textWidth: TextWidth): LabelWidth {
  return (text) => textWidth(text) + LABEL_GAP;
}

export const getLabelWidth = toLabelWidth(estimateTextWidth);

function splitWords(label: string): string[] {
  return label.split(/(?<=[\s-])/u);
}

function breakWord({
  labelWidth,
  room,
  word,
}: {
  labelWidth: LabelWidth;
  room: number;
  word: string;
}): string[] {
  const pieces = [""];

  for (const character of word) {
    const piece = `${pieces.at(-1)}${character}`;

    if (pieces.at(-1) === "" || labelWidth(piece.trim()) <= room) {
      pieces[pieces.length - 1] = piece;
    } else {
      pieces.push(character);
    }
  }

  return pieces;
}

export function getWidestWord(
  labels: readonly string[],
  labelWidth: LabelWidth = getLabelWidth,
): number {
  return Math.max(
    0,
    ...labels.flatMap((label) => splitWords(label).map((word) => labelWidth(word.trim()))),
  );
}

/** Wraps at spaces and hyphens; only a word wider than the whole room breaks between letters. */
export function wrapLabel({
  label,
  labelWidth = getLabelWidth,
  room,
}: {
  label: string;
  labelWidth?: LabelWidth;
  room: number;
}): string[] {
  const lines = [""];
  const words = splitWords(label).flatMap((word) => breakWord({ labelWidth, room, word }));

  for (const word of words) {
    const line = `${lines.at(-1)}${word}`;

    if (labelWidth(line.trim()) <= room) {
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
  labelWidth = getLabelWidth,
}: {
  band: number;
  categories: readonly string[];
  labelWidth?: LabelWidth;
}): CategoryLabelLayout {
  const widestWord = getWidestWord(categories, labelWidth);
  const step = Math.min(Math.max(Math.ceil(widestWord / band), 1), categories.length);

  return {
    lines: categories.map((label) => wrapLabel({ label, labelWidth, room: band * step })),
    step,
  };
}

export function fitsUnderBars({ lines, step }: CategoryLabelLayout): boolean {
  return step === 1 && lines.every((name) => name.length <= MAX_LINES_UNDER_BAR);
}

export function clampLabelCenter({
  labelWidth = getLabelWidth,
  lines,
  start = 0,
  width,
  x,
}: {
  labelWidth?: LabelWidth;
  lines: string[];
  start?: number;
  width: number;
  x: number;
}): number {
  const half = Math.max(...lines.map((line) => labelWidth(line))) / 2;
  return Math.min(Math.max(x, start + half), width - half);
}
