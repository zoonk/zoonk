"use client";

import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { useMindMapActions } from "@/lib/mind-maps/use-mind-map-actions";
import { type FinishedChapter } from "@zoonk/core/sessions/completion-contract";
import {
  FinishedChapterMap,
  FinishedChapterMapProvider,
} from "@zoonk/learn/mind-maps/finished-chapter";

function MainFinishedChapterMap({ chapter }: { chapter: FinishedChapter }) {
  const actions = useMindMapActions(chapter.goalId);
  const learner = useLearnerSummary();
  const plus = learner.status === "ready" && learner.summary.tier === "plus";

  return <FinishedChapterMap actions={actions} chapter={chapter} plus={plus} />;
}

/** Around the screens whose end can finish a chapter: only they load the map's code. */
export function MainFinishedChapterMaps({ children }: { children: React.ReactNode }) {
  return (
    <FinishedChapterMapProvider map={MainFinishedChapterMap}>{children}</FinishedChapterMapProvider>
  );
}
