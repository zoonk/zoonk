"use client";

import { type LessonQuestionMemoryChange } from "@zoonk/core/lesson-questions/contract";
import { type TutorCards } from "@zoonk/learn/tutor-cards";
import { type ReactNode, createContext, use } from "react";
import { type PlayerLinkComponent } from "../player-context";

export type LessonQuestionNavigation = {
  appLinks?: { openBlock?: (blockId: string) => void };
  linkComponent: PlayerLinkComponent;
  loginHref: string;
  subscriptionHref: string;
  renderMemoryUpdate?: (changes: LessonQuestionMemoryChange[]) => ReactNode;
  renderPlanChange?: TutorCards["renderPlanChange"];
  renderToolOffer?: TutorCards["renderToolOffer"];
};

export const LessonQuestionNavigationContext = createContext<LessonQuestionNavigation | null>(null);

export function useLessonQuestionNavigation() {
  const navigation = use(LessonQuestionNavigationContext);

  if (!navigation) {
    throw new Error("Question navigation requires a LessonQuestionPanel");
  }

  return navigation;
}
