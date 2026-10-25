import { type PlanChapterView, type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { normalizeString } from "@zoonk/utils/string";

type PathChapter = Pick<PlanChapterView, "chapterId" | "far" | "state" | "title" | "writing">;

/** A phase's and a chapter's names read as one, whatever their case, accents or spacing. */
function isSameName(first: string, second: string): boolean {
  return normalizeString(first) === normalizeString(second);
}

/**
 * The phase's own chapter: a language's unit, or a course's chapter the phase is named after. A
 * phase that is only that chapter opens straight to it, so its name never shows twice. Lessons
 * still being written for it don't count as another chapter.
 */
export function findOwnChapter<Chapter extends PathChapter>({
  name,
  phase,
}: {
  name: string;
  phase: { chapters: readonly Chapter[] };
}): (Chapter & { chapterId: string }) | null {
  const rows = phase.chapters.filter((chapter) => !chapter.writing || chapter.far);
  const [only] = rows;

  if (rows.length !== 1 || !only?.chapterId || !isSameName(only.title, name)) {
    return null;
  }

  return { ...only, chapterId: only.chapterId };
}

/**
 * A phase named like one of its chapters. The skill graph names each phase for its stage and its
 * checks keep that name off the graph's skills and areas, but plans written before then keep their
 * names (Marcos's "Alugando um apartamento" holds the unit of that name and eight more), and the
 * Library writes chapters after the graph, so no check of the graph sees their titles. Over its
 * listed chapters (an open phase on the path, a band's details), such a phase goes by its place
 * instead ("Phase 2"), so a name never shows twice in a row; a phase that is only that chapter
 * opens straight to it (`findOwnChapter`).
 */
export function isNamedLikeAChapter({
  name,
  phase,
}: {
  name: string;
  phase: { chapters: readonly Pick<PlanChapterView, "title">[] };
}): boolean {
  return phase.chapters.some((chapter) => isSameName(chapter.title, name));
}

/**
 * The phase the path opens: the one holding the plan's next chapter, else the current one. A phase
 * with work left stays closed while the next chapter is in a later one, keeping the next action
 * visible without changing which phase is current.
 */
export function findOpenPhase(
  phases: readonly (Pick<PlanPhaseView, "index" | "state"> & {
    chapters: readonly Pick<PlanChapterView, "state">[];
  })[],
): number | null {
  const withNext = phases.find((phase) =>
    phase.chapters.some((chapter) => chapter.state === "current"),
  );

  return (withNext ?? phases.find((phase) => phase.state === "current"))?.index ?? null;
}
