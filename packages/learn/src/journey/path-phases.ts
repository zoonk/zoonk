import { type PlanChapterView, type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { normalizeString } from "@zoonk/utils/string";

type PathChapter = Pick<PlanChapterView, "chapterId" | "far" | "state" | "title" | "writing">;

function isSameName(first: string, second: string): boolean {
  return normalizeString(first) === normalizeString(second);
}

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
 * Old plans keep phase names their skill graph's checks now prevent, and Library chapters are named
 * after the graph, so a phase can share a chapter's name.
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
