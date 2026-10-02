"use client";

import { type LessonQuestionMemoryChange } from "@zoonk/core/lesson-questions/contract";
import { type ReactNode, createContext, use } from "react";
import { type PlayerLinkComponent } from "../player-context";

export type LessonQuestionNavigation = {
  linkComponent: PlayerLinkComponent;
  loginHref: string;
  subscriptionHref: string;
  /** "Memory updated" with undo under an answer that changed memory; the host owns the undo. */
  renderMemoryUpdate?: (changes: LessonQuestionMemoryChange[]) => ReactNode;
  /** Small thumbs under a finished answer, so the learner can say whether it helped. */
  renderAnswerFeedback?: (questionId: string) => ReactNode;
};

export const LessonQuestionNavigationContext = createContext<LessonQuestionNavigation | null>(null);

/** The host app owns routing and subscription actions, including inside the sheet's portal. */
export function useLessonQuestionNavigation() {
  const navigation = use(LessonQuestionNavigationContext);

  if (!navigation) {
    throw new Error("Question navigation requires a LessonQuestionPanel");
  }

  return navigation;
}
