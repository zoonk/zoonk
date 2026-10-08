import { patternEnding } from "@zoonk/core/library/activities/language";

/** The start every form shares, like "habl" in hablo, hablas, habla. Empty when they differ. */
export function commonStem(words: readonly string[]): string {
  const [first = "", ...rest] = words;

  const length = Array.from({ length: first.length }, (_, index) => index).findIndex((index) =>
    rest.some((word) => word.charAt(index) !== first.charAt(index)),
  );

  return length === -1 ? first : first.slice(0, length);
}

/** A form split into the shared stem and the ending the pattern is about. */
export function splitForm(form: string, stem: string): { ending: string; stem: string } {
  return stem && form.startsWith(stem) && form.length > stem.length
    ? { ending: form.slice(stem.length), stem }
    : { ending: "", stem: form };
}

/** A blank's stem: its answer without the ending the learner picks, like "com" for coméis. */
export function blankStem(choices: readonly string[], answer: string): string {
  const ending = patternEnding(choices, answer) ?? "";
  return answer.slice(0, answer.length - ending.length);
}

/** The next blank to fill after `current`, wrapping around, or null when all are filled. */
export function nextOpenBlank({
  blanks,
  current,
  filled,
}: {
  blanks: readonly number[];
  current: number | null;
  filled: Readonly<Record<string, string>>;
}): number | null {
  const start = current === null ? 0 : blanks.indexOf(current) + 1;
  const ordered = [...blanks.slice(start), ...blanks.slice(0, start)];

  return ordered.find((row) => filled[String(row)] === undefined) ?? null;
}
