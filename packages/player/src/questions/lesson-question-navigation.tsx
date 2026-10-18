"use client";

import { type LessonQuestionMemoryChange } from "@zoonk/core/lesson-questions/contract";
import { type TutorCards } from "@zoonk/learn/tutor-cards";
import { type ReactNode, createContext, use } from "react";
import { type PlayerLinkComponent } from "../player-context";

export type LessonQuestionNavigation = {
  /**
   * A host inside one of the learner's goals, where the buddy answers: its answers link the app,
   * only where they were given a link (see `TutorAnswerLinks`), and `openBlock` opens one of
   * today's blocks as Today does. Without it, an answer's links are the lesson tutor's.
   */
  appLinks?: { openBlock?: (blockId: string) => void };
  linkComponent: PlayerLinkComponent;
  loginHref: string;
  subscriptionHref: string;
  /** "Memory updated" with undo under an answer that changed memory; the host owns the undo. */
  renderMemoryUpdate?: (changes: LessonQuestionMemoryChange[]) => ReactNode;
  /**
   * The plan change the buddy proposed under an answer, with Apply (`getTutorCards`); the host
   * saves the learner's answer. A screen inside a goal passes it, with `renderToolOffer`.
   */
  renderPlanChange?: TutorCards["renderPlanChange"];
  /** The app feature the buddy offered under an answer, with the button that opens it. */
  renderToolOffer?: TutorCards["renderToolOffer"];
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
