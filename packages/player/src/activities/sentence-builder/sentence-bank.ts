import { sentenceKey, sentenceTiles, tileKey } from "@zoonk/core/library/activities/language";
import { seededShuffle } from "@zoonk/utils/seeded-random";

type SentenceFields = { distractors: readonly { why: string; word: string }[]; target: string };

/** A word tile: a word of the target sentence, or a distractor with why it's wrong. */
export type BankTile = { id: string; text: string; why: string | null };

/**
 * The tiles to build from: the target's words and the distractors, shuffled the same way on
 * every visit. A shuffle that happens to spell the target is turned around.
 */
export function bankTiles(fields: SentenceFields): BankTile[] {
  const words = sentenceTiles(fields.target).map((text, index) => ({
    id: `t${index}`,
    text,
    why: null,
  }));

  const distractors = fields.distractors.map((item, index) => ({
    id: `d${index}`,
    text: sentenceTiles(item.word)[0] ?? item.word,
    why: item.why,
  }));

  const shuffled = seededShuffle([...words, ...distractors], fields.target);

  const spellsTarget = shuffled
    .slice(0, words.length)
    .every((tile, index) => tile.id === words[index]?.id);

  return spellsTarget ? shuffled.toReversed() : shuffled;
}

/** The sentence the placed tiles spell, words separated by spaces. */
export function builtSentence(tiles: readonly BankTile[], placedIds: readonly string[]): string {
  return placedIds
    .map((id) => tiles.find((tile) => tile.id === id)?.text)
    .filter((text) => text !== undefined)
    .join(" ");
}

/** Whether a built sentence is one of the accepted ones, compared the way core grades it. */
export function isAcceptedSentence(sentence: string, accepted: readonly string[]): boolean {
  return accepted.some((item) => sentenceKey(item) === sentenceKey(sentence));
}

/**
 * The right sentence word by word (with its punctuation), marking the words the learner's
 * sentence didn't have, so the fix stands out: ¿**Venís** a cenar esta noche?
 */
export function correctionWords(target: string, built: string): { isNew: boolean; word: string }[] {
  const used = new Set(sentenceTiles(built).map((tile) => tileKey(tile)));

  return target
    .split(/\s+/u)
    .filter(Boolean)
    .map((word) => {
      const key = sentenceKey(word);
      return { isNew: key !== "" && !used.has(key), word };
    });
}
