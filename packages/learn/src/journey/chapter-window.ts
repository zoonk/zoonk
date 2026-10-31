const SHOWN_CHAPTERS = 4;

type ChapterState = "current" | "done" | "upcoming";

function findFocusIndex(states: readonly ChapterState[]): number {
  const currentIndex = states.indexOf("current");
  return currentIndex === -1 ? states.findIndex((state) => state !== "done") : currentIndex;
}

export function getChapterWindow({ states }: { states: readonly ChapterState[] }): {
  end: number;
  start: number;
} {
  const anchor = Math.max(0, findFocusIndex(states) - 1);
  const start = Math.max(0, Math.min(anchor, states.length - SHOWN_CHAPTERS));

  return { end: Math.min(states.length, start + SHOWN_CHAPTERS), start };
}
