"use client";

import { type ChapterView } from "@zoonk/core/view-models/chapter/contract";
import { createContext, use } from "react";
import { type TestOutStart } from "../_components/test-out-start-link";
import { type AreaPracticeOutcome } from "../_utils/use-practice-run";

/**
 * Where a chapter's page links: back where the learner came from (the Journey, or the subject they
 * opened it from, named by `backLabel`), and the lesson player (lesson id appended).
 */
export type ChapterHrefs = { back: string; backLabel?: string; lessonBasePath: string };

/**
 * "Practice" on the chapter's skills (a bonus block the host adds through core and opens) and
 * "Take the test", which asks for the test-out's questions and opens it.
 */
export type ChapterActions = {
  practice: () => Promise<AreaPracticeOutcome>;
  startTestOut: () => Promise<TestOutStart>;
};

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
