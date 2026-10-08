import { normalizeString } from "@zoonk/utils/string";
import { nameOverlap, namesMatch } from "../../../exams/_utils/name-match";

/** Below this share of shared words, two names are different subjects that share a word. */
const MIN_OVERLAP = 0.5;

/** How sure a match is, best first; a share of shared words (at most 1) comes after these. */
const MATCH_SCORE = { contained: 2, exact: 4, normalized: 3 } as const;

/** An exact name, the same name written differently, the same subject named shorter, or most words. */
function scoreMatch(area: string, subject: string): number {
  if (area === subject) {
    return MATCH_SCORE.exact;
  }

  if (normalizeString(area) === normalizeString(subject)) {
    return MATCH_SCORE.normalized;
  }

  if (namesMatch(area, subject)) {
    return MATCH_SCORE.contained;
  }

  const overlap = nameOverlap(area, subject);
  return overlap > MIN_OVERLAP ? overlap : 0;
}

/** The subject an area belongs to: its best match, and none when two subjects match it as well. */
function findSubject({ area, subjects }: { area: string; subjects: readonly string[] }) {
  const scores = subjects.map((subject) => scoreMatch(area, subject));
  const best = Math.max(0, ...scores);

  if (best === 0 || scores.filter((score) => score === best).length > 1) {
    return null;
  }

  return scores.indexOf(best);
}

/**
 * Which notice subject each of the plan's areas teaches, by name. Graphs written from the notice
 * name their areas exactly as it does; older ones say "Direito Constitucional" for "Noções de
 * Direito Constitucional e de Regimento Interno", so the match goes from the exact name to most of
 * the words. An area that matches no subject, or two equally, stays out.
 */
export function matchAreasToSubjects({
  areas,
  subjects,
}: {
  areas: readonly string[];
  subjects: readonly string[];
}): Map<string, number> {
  return new Map(
    areas.flatMap((area) => {
      const index = findSubject({ area, subjects });
      return index === null ? [] : [[area, index] as const];
    }),
  );
}

/**
 * Whether the plan follows the notice closely enough to show it by the notice's subjects: at least
 * half of its areas are notice subjects. A plan whose areas are its own topics ("Ecologia",
 * "Filosofia" for ENEM's four areas) shows by its own areas instead, so no subject it does teach
 * reads as missing.
 */
export function followsNotice({
  areas,
  matches,
}: {
  areas: readonly string[];
  matches: ReadonlyMap<string, number>;
}): boolean {
  return areas.length > 0 && matches.size * 2 >= areas.length;
}
