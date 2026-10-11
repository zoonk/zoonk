import { namesMatchAcrossSpellings } from "@zoonk/utils/name-words";
import { normalizeString } from "@zoonk/utils/string";
import { nameOverlap, namesMatch, namesMatchInFull } from "../../../exams/_utils/name-match";

/** Below this share of shared words, two names are different subjects that share a word. */
const MIN_OVERLAP = 0.5;

/** How sure a match is, best first; a share of shared words (at most 1) comes after these. */
const MATCH_SCORE = {
  contained: 3,
  exact: 5,
  normalized: 4,
  respelled: 1.5,
  shortened: 2,
} as const;

/** A notice subject by the names it goes by: its own, and the short one learners use, if any. */
type SubjectNames = { name: string; shortName?: string | null };

/**
 * An exact name, the same name written differently, the same subject named shorter (in its own
 * words, else with shortened ones), the same name in another language's spelling, or most words.
 * A name in its own words wins over one that only begins like it: ENEM graphs name the languages
 * area by a word that also begins the name of the foreign language a learner picks, and that option
 * mustn't take the area from its subject. A graph for a Portuguese speaker can spell a Spanish
 * notice's subject in Portuguese (DELE's "Expresión e interacción escritas").
 */
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

/**
 * How well an area names a subject: by the subject's own name, or exactly by its short name, which
 * is the same subject as surely as its own name written differently ("Professional Ethics" is the
 * OAB's "Statute of the Legal Profession and of the OAB… and Code of Ethics and Discipline of the OAB").
 */
function scoreMatch(area: string, subject: SubjectNames): number {
  const short =
    subject.shortName && normalizeString(area) === normalizeString(subject.shortName)
      ? MATCH_SCORE.normalized
      : 0;

  return Math.max(scoreName(area, subject.name), short);
}

/** The subject an area belongs to: its best match, and none when two subjects match it as well. */
function findSubject({ area, subjects }: { area: string; subjects: readonly SubjectNames[] }) {
  const scores = subjects.map((subject) => scoreMatch(area, subject));
  const best = Math.max(0, ...scores);

  if (best === 0 || scores.filter((score) => score === best).length > 1) {
    return null;
  }

  return scores.indexOf(best);
}

/**
 * Which notice subject each of the plan's areas teaches. Graphs written with the notice name their
 * areas exactly as it does (see `placeInExam`); one written before it was read uses the names
 * learners use, such as the subject's short name or "Constitutional Law" for "Basics of
 * Constitutional Law and Internal Rules", so the match goes from the exact name to most of
 * the words. An area that matches no subject, or two equally, stays out.
 */
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

/**
 * Whether the plan follows the notice closely enough to show it by the notice's subjects: at least
 * half of its areas are notice subjects. A plan whose areas are its own topics ("Ecology",
 * "Philosophy" for ENEM's four areas) shows by its own areas instead, so no subject it does teach
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
