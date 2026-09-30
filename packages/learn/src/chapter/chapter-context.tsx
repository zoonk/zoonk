"use client";

import { type ChapterView } from "@zoonk/core/view-models/chapter/contract";
import { createContext, use } from "react";
import { type AreaPracticeOutcome } from "../progress/progress-context";

/**
 * Where a chapter's page links: back to where it opened from, the lesson player (the lesson id is
 * appended) and the mistakes notebook.
 */
export type ChapterHrefs = { back: string; lessonBasePath: string; mistakes: string };

/** "Practice" on the chapter's skills: the host adds the bonus block through core and opens it. */
export type ChapterActions = { practice: () => Promise<AreaPracticeOutcome> };

type ChapterScreenValue = {
  actions: ChapterActions;
  /** The host's "Ask" for questions about this chapter, beside the chapter's menu. */
  ask?: React.ReactNode;
  chapter: ChapterView;
  hrefs: ChapterHrefs;
};

const ChapterScreenContext = createContext<ChapterScreenValue | null>(null);

export function ChapterScreenProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ChapterScreenValue;
}) {
  return <ChapterScreenContext value={value}>{children}</ChapterScreenContext>;
}

export function useChapterScreen(): ChapterScreenValue {
  const value = use(ChapterScreenContext);

  if (!value) {
    throw new Error("Chapter components must be used within ChapterScreen");
  }

  return value;
}

/** Where a lesson opens: the player, for lessons done and the next one. */
export function useLessonHref() {
  const { hrefs } = useChapterScreen();
  return (lessonId: string) => `${hrefs.lessonBasePath}/${lessonId}`;
}
