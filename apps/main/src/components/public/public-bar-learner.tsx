"use client";

import { UserAvatarMenu } from "@/app/[lang]/(app)/(catalog)/_components/user-avatar-menu";
import { LearnGoalMenu } from "@/app/[lang]/(app)/(learn)/_components/learn-goal-menu";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { LearnAvatarBelt } from "@zoonk/learn/avatar-belt";
import { type ReactNode } from "react";

/**
 * The public bar's left for anyone with a session: the app's goal switcher, as on every other
 * screen of theirs. Public pages are static, so their HTML has a visitor's (`visitor`), which stays
 * until the browser's learner summary reads someone.
 */
export function PublicBarStart({ visitor }: { visitor: ReactNode }) {
  const learner = useLearnerSummary();

  if (learner.status !== "ready") {
    return visitor;
  }

  return (
    <MainLearnProvider>
      <LearnGoalMenu />
    </MainLearnProvider>
  );
}

/**
 * The public bar's account action: a visitor's way in (`visitor`, what the static HTML has) until
 * the browser's learner summary reads someone, then their account menu, wearing their belt.
 */
export function PublicBarAccount({ visitor }: { visitor: ReactNode }) {
  const learner = useLearnerSummary();

  if (learner.status !== "ready") {
    return visitor;
  }

  return (
    <LearnAvatarBelt color={learner.summary.level?.color ?? null}>
      <UserAvatarMenu />
    </LearnAvatarBelt>
  );
}
