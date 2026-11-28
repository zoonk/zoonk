import { normalizeDistractorKey } from "@zoonk/utils/distractors";
import { segmentWords } from "@zoonk/utils/string";

/** Shorter words start too many others ("pat" in "pattern") to count a longer word as a form of them. */
const MIN_STEM_LENGTH = 4;

function toKeys(text: string): string[] {
  return segmentWords(text)
    .map((word) => normalizeDistractorKey(word))
    .filter(Boolean);
}

function containsRun({ keys, run }: { keys: readonly string[]; run: readonly string[] }): boolean {
  return keys.some((_, start) => run.every((key, offset) => keys[start + offset] === key));
}

/**
 * When the learner reads the app in the language they're learning, a word's meaning is a
 * definition, and one that names the word gives the answer away.
 */
export function definitionNamesWord({
  definition,
  word,
}: {
  definition: string;
  word: string;
}): boolean {
  const run = toKeys(word);
  const keys = toKeys(definition);
  const [single] = run;

  if (run.length === 0 || keys.length === 0) {
    return false;
  }

  if (containsRun({ keys, run })) {
    return true;
  }

  return (
    run.length === 1 &&
    single !== undefined &&
    single.length >= MIN_STEM_LENGTH &&
    keys.some((key) => key.startsWith(single))
  );
}

/**
 * A number in digits looks the same in both languages, so the learner picks its word tile by sight.
 * Digits joined to letters are a code, such as "A4" or "4G", which stays as written.
 */
export function writesNumberInDigits(text: string): boolean {
  return /(?<![\p{L}\p{Nd}])\p{Nd}+(?![\p{L}\p{Nd}])/u.test(text);
}
