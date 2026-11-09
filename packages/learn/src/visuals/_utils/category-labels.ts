/** About how wide one character of a 12px label is, to keep category labels from overlapping. */
const LABEL_CHAR_WIDTH = 6.6;
const LABEL_GAP = 6;

export type CategoryLabelLayout = { lines: string[][]; step: number };

export function getLabelWidth(text: string): number {
  return text.length * LABEL_CHAR_WIDTH + LABEL_GAP;
}

function splitWords(label: string): string[] {
  return label.split(/(?<=[\s-])/u);
}

function wrapLabel({ label, room }: { label: string; room: number }): string[] {
  const lines = [""];

  for (const word of splitWords(label)) {
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
 * every few names show, each with the room of the ones it skips.
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

  const step = Math.max(Math.ceil(widestWord / band), 1);

  return { lines: categories.map((label) => wrapLabel({ label, room: band * step })), step };
}
