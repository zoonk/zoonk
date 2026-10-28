export type BlankState = (string | null)[];

function isComplete(blanks: BlankState): blanks is string[] {
  return blanks.every((blank) => blank !== null);
}

export function getCompletedUserAnswers(blanks: BlankState): string[] | null {
  if (!isComplete(blanks)) {
    return null;
  }

  return blanks;
}
