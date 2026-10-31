"use client";

import { UserAvatarMenu } from "@/app/[lang]/(app)/(catalog)/_components/user-avatar-menu";
import { LearnGoalMenu } from "@/app/[lang]/(app)/(learn)/_components/learn-goal-menu";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { LearnAvatarBelt } from "@zoonk/learn/avatar-belt";
import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";

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
 * Until the summary answers, a browser whose session hint says it holds a session shows a circle the
 * menu's size, so a learner never sees "Log in" and nothing moves when their avatar arrives.
 */
export function PublicBarAccount({ visitor }: { visitor: ReactNode }) {
  const learner = useLearnerSummary();

  if (learner.status === "ready") {
    return (
      <LearnAvatarBelt color={learner.summary.level?.color ?? null}>
        <UserAvatarMenu includeSearch />
      </LearnAvatarBelt>
    );
  }

  const known = learner.status === "visitor";

  return (
    <>
      <span className={cn("contents", !known && "signed-in:hidden")}>{visitor}</span>

      {!known && (
        <span
          aria-hidden="true"
          className="bg-muted signed-in:block hidden size-7 shrink-0 rounded-full"
          data-slot="public-account-slot"
        />
      )}
    </>
  );
}
