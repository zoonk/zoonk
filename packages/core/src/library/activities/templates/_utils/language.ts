import { trimPunctuation } from "@zoonk/utils/string";

function sentenceWords(sentence: string): string[] {
  return sentence
    .split(/\s+/u)
    .map((word) => trimPunctuation(word))
    .filter(Boolean);
}

export function sentenceKey(sentence: string): string {
  return sentenceWords(sentence)
    .map((word) => word.toLocaleLowerCase())
    .join(" ");
}

export function patternEnding(choices: readonly string[], answer: string): string | null {
  return (
    choices
      .filter((choice) => answer.endsWith(choice))
      .toSorted((a, b) => b.length - a.length)[0] ?? null
  );
}
