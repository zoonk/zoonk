import { normalizeTypedAnswer } from "@zoonk/ai/tasks/grading/typed-answer-match";
import { getBaseLanguage } from "@zoonk/utils/languages";

const SERBIAN_LATIN = new Map([
  ["а", "a"],
  ["б", "b"],
  ["в", "v"],
  ["г", "g"],
  ["д", "d"],
  ["е", "e"],
  ["ж", "ž"],
  ["з", "z"],
  ["и", "i"],
  ["к", "k"],
  ["л", "l"],
  ["м", "m"],
  ["н", "n"],
  ["о", "o"],
  ["п", "p"],
  ["р", "r"],
  ["с", "s"],
  ["т", "t"],
  ["у", "u"],
  ["ф", "f"],
  ["х", "h"],
  ["ц", "c"],
  ["ч", "č"],
  ["ш", "š"],
  ["ђ", "đ"],
  ["ј", "j"],
  ["љ", "lj"],
  ["њ", "nj"],
  ["ћ", "ć"],
  ["џ", "dž"],
]);

function inLessonScript(text: string, language: string): string {
  if (language === "sr") {
    return text.replaceAll(/\p{Script=Cyrillic}/gu, (char) => SERBIAN_LATIN.get(char) ?? char);
  }

  if (language === "ja") {
    const katakanaOffset = 0x60;

    return text.replaceAll(/[ァ-ヶ]/gu, (char) => {
      const point = char.codePointAt(0);
      return point === undefined ? char : String.fromCodePoint(point - katakanaOffset);
    });
  }

  return text;
}

function isMandarin(language: string): boolean {
  const base = getBaseLanguage(language);
  return base === "zh" || base === "cmn";
}

export async function needsSurnameCheck({
  expected,
  language,
  romanization,
}: {
  expected: string;
  language: string;
  romanization?: string | null;
}): Promise<boolean> {
  if (!romanization || !isMandarin(language)) {
    return false;
  }

  const { hasSurnameReading } = await import("./mandarin-reading");
  return hasSurnameReading(expected, romanization);
}

/**
 * A transcript spells what the transcriber guessed, so another spelling can still be the sentence
 * said right (a homophone, a silent letter, a number or letter name written another way): only the
 * recording can tell. A Mandarin transcript is the exception, since its tones show other syllables.
 */
export async function transcriptReading({
  expected,
  heard,
  language,
  romanization,
}: {
  expected: string;
  heard: string;
  language: string;
  romanization?: string | null;
}): Promise<"equivalent" | "listen" | "different"> {
  const base = getBaseLanguage(language);

  if (isMandarin(language)) {
    const { mandarinReading } = await import("./mandarin-reading");
    return mandarinReading({ expected, heard, romanization });
  }

  const written = normalizeTypedAnswer(expected, base);
  const recognized = normalizeTypedAnswer(heard, base);
  const target = inLessonScript(written, base);
  const transcript = inLessonScript(recognized, base);

  if (!target || !transcript) {
    return "different";
  }

  if (target === transcript) {
    // In Cyrillic нј and њ are distinct, but both can be written "nj" in Latin.
    return base === "sr" && /нј|лј|дж/u.test(`${written} ${recognized}`) ? "listen" : "equivalent";
  }

  return "listen";
}
