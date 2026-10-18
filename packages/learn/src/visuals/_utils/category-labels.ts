/** About how wide one character of a 12px label is, to keep category labels from overlapping. */
const LABEL_CHAR_WIDTH = 6.6;
/** The room kept between two neighboring labels. */
const LABEL_GAP = 6;

/** Each category's label as its lines, and which labels show: every one, or every `step`th. */
export type CategoryLabelLayout = { lines: string[][]; step: number };

function getLabelWidth(text: string): number {
  return text.length * LABEL_CHAR_WIDTH + LABEL_GAP;
}

/** A label broken at the space or hyphen nearest its middle ("Segunda-" / "feira"). */
function splitLabel(label: string): string[] {
  const middle = label.length / 2;
  const breaks = [...label.matchAll(/[\s-]/gu)].map((match) => match.index);

  const [at] = breaks.toSorted(
    (first, second) => Math.abs(first - middle) - Math.abs(second - middle),
  );

  if (at === undefined) {
    return [label];
  }

  return [label.slice(0, label[at] === "-" ? at + 1 : at), label.slice(at + 1)];
}

/**
 * Category labels under their bars or points: on one line when they fit, over two lines when that
 * makes them fit, and otherwise every second or third one.
 */
export function getCategoryLabels({
  band,
  categories,
}: {
  band: number;
  categories: readonly string[];
}): CategoryLabelLayout {
  const fits = (labels: string[][]) =>
    labels.every((lines) => lines.every((line) => getLabelWidth(line) <= band));

  const single = categories.map((category) => [category]);
  const split = categories.map((category) => splitLabel(category));

  if (fits(single)) {
    return { lines: single, step: 1 };
  }

  if (fits(split)) {
    return { lines: split, step: 1 };
  }

  const longest = Math.max(...categories.map((category) => getLabelWidth(category)));
  return { lines: single, step: Math.ceil(longest / band) };
}
