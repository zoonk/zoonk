"use client";

import { type GenerationQuotaViewer } from "@zoonk/core/generation-quotas/contract";
import { type ReactNode, createContext, use } from "react";
import { type PlayerLinkComponent } from "../player-context";

export type LessonQuestionLimitActionProps = {
  className?: string;
  loginHref: string;
  viewer: GenerationQuotaViewer;
};

export type LessonQuestionNavigation = {
  linkComponent: PlayerLinkComponent;
  loginHref: string;
  subscriptionHref: string;
  renderLimitAction: (props: LessonQuestionLimitActionProps) => ReactNode;
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
