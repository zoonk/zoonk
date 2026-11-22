import { pinyin, polyphonic } from "pinyin-pro";
import { toSimplifiedChinese } from "./simplified-chinese";

const HAN = /^\p{Script=Han}+$/u;
const BOUNDARIES = /^[\s'’\-，。,.!?！？]+/u;
const VOWEL_INITIAL = /^[aoe]/u;

function matchesLessonReading(syllables: readonly string[], romanization: string): boolean {
  let remaining = romanization.toLowerCase().normalize("NFD").trim();

  for (const [index, syllable] of syllables.entries()) {
    const reading = syllable.normalize("NFD");
    const next = remaining.replace(BOUNDARIES, "");

    // In joined pinyin a vowel-initial syllable needs a separator: Xī'ān and xiān differ.
    if (index > 0 && next === remaining && VOWEL_INITIAL.test(reading)) {
      return false;
    }

    if (!/^[a-z\p{M}]+$/u.test(reading) || !next.startsWith(reading)) {
      return false;
    }

    remaining = next.slice(reading.length);
  }

  return remaining.replace(BOUNDARIES, "") === "";
}

function hanText(text: string): string {
  return toSimplifiedChinese(text).replaceAll(/[\p{P}\s]/gu, "");
}

export function hasSurnameReading(expected: string, romanization: string): boolean {
  const target = hanText(expected);

  return (
    HAN.test(target) &&
    !matchesLessonReading(pinyin(target, { type: "array" }), romanization) &&
    matchesLessonReading(pinyin(target, { mode: "surname", type: "array" }), romanization)
  );
}

export function mandarinReading({
  expected,
  heard,
  romanization,
}: {
  expected: string;
  heard: string;
  romanization?: string | null;
}): "different" | "equivalent" | "listen" {
  const target = hanText(expected);
  const transcript = hanText(heard);

  if (!romanization || !HAN.test(target) || !HAN.test(transcript)) {
    return "different";
  }

  const characters = transcript.match(/\p{Script=Han}/gu) ?? [];
  const targetCharacters = target.match(/\p{Script=Han}/gu) ?? [];

  if (characters.length !== targetCharacters.length) {
    return "different";
  }

  if (!matchesLessonReading(pinyin(transcript, { type: "array" }), romanization)) {
    return "different";
  }

  const ambiguous = characters.some(
    (character, index) =>
      character !== targetCharacters[index] &&
      (polyphonic(character, { type: "array" })[0]?.length ?? 0) > 1,
  );

  return ambiguous ? "listen" : "equivalent";
}
