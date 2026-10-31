type Passage = { id: string; text: string };

type PassageRange = { end: number; id: string; start: number };

export type ExcerptSegment = { passageId: string | null; text: string };

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

export function hasOverlappingPassages(excerpt: string, passages: readonly Passage[]): boolean {
  const ranges = locatePassages(excerpt, passages);
  return ranges.some((range, index) => index > 0 && range.start < (ranges[index - 1]?.end ?? 0));
}

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
