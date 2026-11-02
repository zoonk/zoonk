/** Stress, length, syllable marks, tie bars and delimiters don't change which sounds are said. */
const IGNORED_MARKS = /[ˈˌːˑ.‿/[\]\s]|͡|͜/gu;
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Each sound as one unit, a nasal "ĩ" included, so a missing mark counts as one change. */
function toSounds(ipa: string): string[] {
  const sounds = ipa.normalize("NFC").replaceAll(IGNORED_MARKS, "").replaceAll("g", "ɡ");
  return Array.from(graphemes.segment(sounds), (segment) => segment.segment);
}

/**
 * Consonants that differ only in voicing, which accents swap without changing the word (German
 * says "Kind" as kɪnt; a voice saying kɪnd still has its vowel, not English kaɪnd).
 */
const VOICING_PAIRS = new Set(["bp", "dt", "ɡk", "vf", "zs", "ʒʃ", "ðθ"]);
const VOICING_COST = 0.5;

function getSubstitutionCost(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return VOICING_PAIRS.has(left + right) || VOICING_PAIRS.has(right + left) ? VOICING_COST : 1;
}

function getDistance(from: readonly string[], to: readonly string[]): number {
  let previous = Array.from({ length: to.length + 1 }, (_, index) => index);

  for (const [row, sound] of from.entries()) {
    const current = [row + 1];

    for (const [column, other] of to.entries()) {
      current.push(
        Math.min(
          (previous[column] ?? 0) + getSubstitutionCost(sound, other),
          (previous[column + 1] ?? 0) + 1,
          (current[column] ?? 0) + 1,
        ),
      );
    }

    previous = current;
  }

  return previous[to.length] ?? Math.max(from.length, to.length);
}

/** 0 for nothing shared, 1 for the same sounds. */
export function getIpaSimilarity(left: string, right: string): number {
  const from = toSounds(left);
  const to = toSounds(right);
  return 1 - getDistance(from, to) / Math.max(from.length, to.length, 1);
}

/**
 * "ˈtaɪmi" is one sound away from the English "taɪm", so it isn't Brazilian Portuguese "ˈtʃimi".
 */
export function isCloserToNative({
  englishIpa,
  heard,
  ipa,
}: {
  englishIpa: string;
  heard: string;
  ipa: string;
}): boolean {
  return getIpaSimilarity(heard, ipa) > getIpaSimilarity(heard, englishIpa);
}
