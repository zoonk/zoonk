/**
 * Where a line limit's cut shows: a word it splits is shown past the limit whole, so the cut moves
 * back to that word's start; a cut on a space or at a word's start stays where the grader put it.
 * Offsets are UTF-16 code units, as the grade's `ignoredFrom`.
 */
export function toWordStart(text: string, offset: number): number {
  const after = text.slice(offset, offset + 1);

  if (!after || /\s/u.test(after)) {
    return offset;
  }

  const splitWord = /\S*$/u.exec(text.slice(0, offset))?.[0] ?? "";
  return offset - splitWord.length;
}
