import { patternEnding } from "@zoonk/core/library/activities/language";

export function commonStem(words: readonly string[]): string {
  const [first = "", ...rest] = words;

  const length = Array.from({ length: first.length }, (_, index) => index).findIndex((index) =>
    rest.some((word) => word.charAt(index) !== first.charAt(index)),
  );

  return length === -1 ? first : first.slice(0, length);
}

export function splitForm(form: string, stem: string): { ending: string; stem: string } {
  return stem && form.startsWith(stem) && form.length > stem.length
    ? { ending: form.slice(stem.length), stem }
    : { ending: "", stem: form };
}

export function blankStem(choices: readonly string[], answer: string): string {
  const ending = patternEnding(choices, answer) ?? "";
  return answer.slice(0, answer.length - ending.length);
}

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
