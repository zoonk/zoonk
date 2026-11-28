import { getBaseLanguage } from "@zoonk/utils/languages";
import { normalizeTypedAnswer } from "../grading/typed-answer-match";

const NOT_LETTER_OR_DIGIT = /[^\p{L}\p{N}]/gu;

/** One more letter is a transcriber's spelling ("a" written "ah"), not another word. */
const MIN_ADDED_LETTERS = 2;

function toLetters({ language, text }: { language: string; text: string }): string {
  return normalizeTypedAnswer(text, getBaseLanguage(language)).replaceAll(NOT_LETTER_OR_DIGIT, "");
}

/**
 * Whether a clip's transcript goes on past its text, as when a voice reading "abito a" adds "Roma".
 * Only the whole text followed by more counts, so a transcriber's own differences (spelling,
 * numbers written out, another script) never read as a voice adding words.
 */
export function saysMoreThanText({
  heard,
  language,
  text,
}: {
  heard: string;
  language: string;
  text: string;
}): boolean {
  const expected = toLetters({ language, text });
  const said = toLetters({ language, text: heard });

  return (
    expected.length > 0 &&
    said.startsWith(expected) &&
    said.length - expected.length >= MIN_ADDED_LETTERS
  );
}
