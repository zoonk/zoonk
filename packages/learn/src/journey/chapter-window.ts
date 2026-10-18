/** Rows a phase shows before "+ N chapters". */
const SHOWN_CHAPTERS = 4;

type ChapterState = "current" | "done" | "upcoming";

/** The chapter the learner is in, else the first one left, else -1. */
function findFocusIndex(states: readonly ChapterState[]): number {
  const currentIndex = states.indexOf("current");
  return currentIndex === -1 ? states.findIndex((state) => state !== "done") : currentIndex;
}

/**
 * The chapters a phase shows before it's expanded: a window that starts one row before the
 * chapter the learner is in (or, outside the current phase, the first one left) so it's always in
 * sight, however far into the phase the learner is. Lessons interleave, so done and open chapters
 * mix. Without a chapter left, it's the first ones.
 */
export function getChapterWindow({ states }: { states: readonly ChapterState[] }): {
  end: number;
  start: number;
} {
  const anchor = Math.max(0, findFocusIndex(states) - 1);
  const start = Math.max(0, Math.min(anchor, states.length - SHOWN_CHAPTERS));

  return { end: Math.min(states.length, start + SHOWN_CHAPTERS), start };
}
