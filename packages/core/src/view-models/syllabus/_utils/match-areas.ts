import { namesMatchAcrossSpellings } from "@zoonk/utils/name-words";
import { normalizeString } from "@zoonk/utils/string";
import { nameOverlap, namesMatch, namesMatchInFull } from "../../../exams/_utils/name-match";

/** Below this share of shared words, two names are different subjects that share a word. */
const MIN_OVERLAP = 0.5;

const MATCH_SCORE = {
  contained: 3,
  exact: 5,
  normalized: 4,
  respelled: 1.5,
  shortened: 2,
} as const;

type SubjectNames = { name: string; shortName?: string | null };

/** Prefer whole subject words over prefixes so a foreign-language option cannot steal its parent subject's area. */
function scoreName(area: string, subject: string): number {
  if (area === subject) {
    return MATCH_SCORE.exact;
  }

  if (normalizeString(area) === normalizeString(subject)) {
    return MATCH_SCORE.normalized;
  }

  if (namesMatch(area, subject)) {
    return namesMatchInFull(area, subject) ? MATCH_SCORE.contained : MATCH_SCORE.shortened;
  }

  if (namesMatchAcrossSpellings(area, subject)) {
    return MATCH_SCORE.respelled;
  }

  const overlap = nameOverlap(area, subject);
  return overlap > MIN_OVERLAP ? overlap : 0;
}

function scoreMatch(area: string, subject: SubjectNames): number {
  const short =
    subject.shortName && normalizeString(area) === normalizeString(subject.shortName)
      ? MATCH_SCORE.normalized
      : 0;

  return Math.max(scoreName(area, subject.name), short);
}

function findSubject({ area, subjects }: { area: string; subjects: readonly SubjectNames[] }) {
  const scores = subjects.map((subject) => scoreMatch(area, subject));
  const best = Math.max(0, ...scores);

  if (best === 0 || scores.filter((score) => score === best).length > 1) {
    return null;
  }

  return scores.indexOf(best);
}

/** Leaves unmatched and tied areas out; accepts learner-facing short names from plans written before notice research. */
export function matchAreasToSubjects({
  areas,
  subjects,
}: {
  areas: readonly string[];
  subjects: readonly SubjectNames[];
}): Map<string, number> {
  return new Map(
    areas.flatMap((area) => {
      const index = findSubject({ area, subjects });
      return index === null ? [] : [[area, index] as const];
    }),
  );
}

/** Requires at least half the areas to match; topic-based plans keep their own grouping to avoid false missing subjects. */
export function followsNotice({
  areas,
  matches,
}: {
  areas: readonly string[];
  matches: ReadonlyMap<string, number>;
}): boolean {
  return areas.length > 0 && matches.size * 2 >= areas.length;
}
