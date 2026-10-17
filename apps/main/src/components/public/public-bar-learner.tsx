"use client";

import { UserAvatarMenu } from "@/app/[lang]/(app)/(catalog)/_components/user-avatar-menu";
import { LearnGoalMenu } from "@/app/[lang]/(app)/(learn)/_components/learn-goal-menu";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { LearnAvatarBelt } from "@zoonk/learn/avatar-belt";
import { cn } from "@zoonk/ui/lib/utils";
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
 * The public bar's account action: their account menu, wearing their belt and leading with search
 * (public pages have no sidebar or search field), once the browser's learner summary reads
 * someone, and a visitor's way in (`visitor`, what the static HTML has) otherwise. Until the
 * summary answers (or when it can't), a browser whose session hint says it holds a session shows a
 * quiet circle the account menu's size instead (`signed-in:`), so a learner never sees "Log in" and
 * nothing moves when their avatar arrives.
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
