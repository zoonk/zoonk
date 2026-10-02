type Passage = { id: string; text: string };

type PassageRange = { end: number; id: string; start: number };

/** A piece of an excerpt: plain text, or a passage the learner can mark. */
export type ExcerptSegment = { passageId: string | null; text: string };

/**
 * Where each passage sits in its excerpt: its first exact occurrence, in reading order. A passage
 * that isn't quoted from the excerpt has no place and is left out.
 */
function locatePassages(excerpt: string, passages: readonly Passage[]): PassageRange[] {
  return passages
    .map((passage) => ({
      id: passage.id,
      start: excerpt.indexOf(passage.text),
      text: passage.text,
    }))
    .filter((range) => range.start !== -1 && range.text.length > 0)
    .map((range) => ({ end: range.start + range.text.length, id: range.id, start: range.start }))
    .toSorted((first, second) => first.start - second.start);
}

/** Two passages share words, so marking one would mark part of the other. */
export function hasOverlappingPassages(excerpt: string, passages: readonly Passage[]): boolean {
  const ranges = locatePassages(excerpt, passages);
  return ranges.some((range, index) => index > 0 && range.start < (ranges[index - 1]?.end ?? 0));
}

/**
 * Splits an excerpt into plain text and markable passages, in reading order, so the player draws
 * exactly the passages the validator checked. Overlapping passages are rejected before
 * publishing; here a later overlapping one is skipped.
 */
export function splitExcerpt(excerpt: string, passages: readonly Passage[]): ExcerptSegment[] {
  const ranges: PassageRange[] = [];

  for (const range of locatePassages(excerpt, passages)) {
    if (range.start >= (ranges.at(-1)?.end ?? 0)) {
      ranges.push(range);
    }
  }

  const segments = ranges.flatMap((range, index) => {
    const previousEnd = ranges[index - 1]?.end ?? 0;
    const before = excerpt.slice(previousEnd, range.start);

    return [
      ...(before ? [{ passageId: null, text: before }] : []),
      { passageId: range.id, text: excerpt.slice(range.start, range.end) },
    ];
  });

  const rest = excerpt.slice(ranges.at(-1)?.end ?? 0);
  return rest ? [...segments, { passageId: null, text: rest }] : segments;
}
