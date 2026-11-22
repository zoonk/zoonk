import { normalizeTypedAnswer } from "@zoonk/ai/tasks/grading/typed-answer-match";
import { getBaseLanguage } from "@zoonk/utils/languages";
import { hasMatchingPhonemes } from "./transcript-phonemes";

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

function swapsKanjiForKana(left: string, right: string): boolean {
  let start = 0;

  while (start < left.length && left[start] === right[start]) {
    start += 1;
  }

  let end = 0;

  while (
    end < Math.min(left.length, right.length) - start &&
    left.at(-end - 1) === right.at(-end - 1)
  ) {
    end += 1;
  }

  const a = left.slice(start, left.length - end);
  const b = right.slice(start, right.length - end);
  const kanji = /^\p{Script=Han}+$/u;
  const kana = /^[\p{Script=Hiragana}ー]+$/u;
  return (kanji.test(a) && kana.test(b)) || (kana.test(a) && kanji.test(b));
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
    if (base === "sr" && /нј|лј|дж/u.test(`${written} ${recognized}`)) {
      return /\p{Script=Latin}/u.test(written) === /\p{Script=Latin}/u.test(recognized)
        ? "different"
        : "listen";
    }

    return "equivalent";
  }

  if (target.replaceAll(/[ -]/gu, "") === transcript.replaceAll(/[ -]/gu, "")) {
    return "listen";
  }

  if (base === "ja") {
    return swapsKanjiForKana(target.replaceAll(" ", ""), transcript.replaceAll(" ", ""))
      ? "listen"
      : "different";
  }

  return hasMatchingPhonemes({ expected: target, heard: transcript, language })
    ? "listen"
    : "different";
}
