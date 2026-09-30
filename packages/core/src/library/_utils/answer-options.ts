import { seededShuffle } from "@zoonk/utils/seeded-random";

const OPTION_IDS = ["a", "b", "c", "d", "e"] as const;

/**
 * Answer options in the order they're stored and shown. Writers tend to list the right answer
 * first, so options are shuffled once, the same way for the same options, and the position never
 * gives the answer away on any screen, review or public page.
 */
export function shuffleAnswerOptions<T extends { text: string }>(options: readonly T[]): T[] {
  return seededShuffle(options, options.map((option) => option.text).join("\n"));
}

/** Option ids are letters in the order the options are stored and shown. */
export function getOptionId(index: number): string {
  return OPTION_IDS[index] ?? String(index);
}

/** A letter printed before an option, as exam papers do: "A) ", "(b) ", "C. ". */
const OPTION_LABEL = /^\s*(?:\((?<enclosed>[a-e])\)|(?<letter>[a-e])[).])\s+/iu;

type OptionLabel = { length: number; letter: string; shape: string };

function readOptionLabel(text: string): OptionLabel | null {
  const match = OPTION_LABEL.exec(text);
  const letter = match?.groups?.enclosed ?? match?.groups?.letter;

  if (!match || !letter) {
    return null;
  }

  return { length: match[0].length, letter, shape: match[0].trim().replace(letter, "") };
}

/**
 * Letters are labels only when every option has one, printed the same way, and together they run
 * from A with no gaps in one case. Content that happens to start like a label ("C. elegans", "A)
 * and B) are both…") never passes all of that.
 */
function isLabelSet(labels: readonly (OptionLabel | null)[]): labels is OptionLabel[] {
  const found = labels.filter((label) => label !== null);
  const letters = found.map((label) => label.letter);
  const expected = OPTION_IDS.slice(0, labels.length).join("");

  return (
    found.length === labels.length &&
    new Set(found.map((label) => label.shape)).size === 1 &&
    (letters.every((letter) => letter === letter.toUpperCase()) ||
      letters.every((letter) => letter === letter.toLowerCase())) &&
    letters
      .map((letter) => letter.toLowerCase())
      .toSorted()
      .join("") === expected
  );
}

/**
 * Options without the letters a writer printed before them. Options are shuffled and every screen
 * shows its own badge, so a printed "D) " would read "A · D) …" and point at the wrong option.
 */
export function stripOptionLabels<T extends { text: string }>(options: readonly T[]): T[] {
  const labels = options.map((option) => readOptionLabel(option.text));

  if (!isLabelSet(labels)) {
    return [...options];
  }

  return options.map((option, index) => ({
    ...option,
    text: option.text.slice(labels[index]?.length ?? 0),
  }));
}
