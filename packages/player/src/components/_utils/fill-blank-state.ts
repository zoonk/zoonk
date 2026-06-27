export type BlankState = (string | null)[];

/**
 * Complete blanks can be serialized into the public answer shape. Incomplete
 * blanks return null so callers do not accidentally submit partial answers.
 */
function isComplete(blanks: BlankState): blanks is string[] {
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

  return blanks;
}
