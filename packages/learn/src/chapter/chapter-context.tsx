"use client";

import { type ChapterView } from "@zoonk/core/view-models/chapter/contract";
import { createContext, use } from "react";
import { type TestOutStart } from "../_components/test-out-start-link";
import { type AreaPracticeOutcome } from "../_utils/use-practice-run";

export type ChapterHrefs = { back: string; backLabel?: string; lessonBasePath: string };

export type ChapterActions = {
  practice: () => Promise<AreaPracticeOutcome>;
  startTestOut: () => Promise<TestOutStart>;
};

type ChapterScreenValue = {
  actions: ChapterActions;
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
