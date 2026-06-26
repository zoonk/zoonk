import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";

type BlankValue = { sourceIndex: number | null; word: string };
export type BlankState = (BlankValue | null)[];
export type WordPlacement = { option: WordBankOption; sourceIndex: number };

/**
 * Fill-blank answer state tracks source tile indexes only for interaction.
 * The selected-answer contract remains the original string array.
 */
export function getBlankWords(blanks: BlankState): (string | null)[] {
  return blanks.map((blank) => blank?.word ?? null);
}

/**
 * Complete blanks can be serialized into the public answer shape. Incomplete
 * blanks return null so callers do not accidentally submit partial answers.
 */
function isComplete(blanks: BlankState): blanks is BlankValue[] {
  return blanks.every((blank) => blank !== null);
}

/**
 * Converts complete internal blank state back to the public answer shape. Null
 * means the learner has not filled every blank yet.
 */
export function getCompletedUserAnswers(blanks: BlankState): string[] | null {
  if (!isComplete(blanks)) {
    return null;
  }

  return blanks.map((blank) => blank.word);
}
