import { AuthGatePage } from "@/components/auth-gate";
import { getReadAt } from "@/lib/learn/read-at";
import { getActiveGoalId } from "@zoonk/core/goals/active-goal";
import { getOwnedGoal } from "@zoonk/core/goals/owned-goal";
import { hasEarlierQuestions } from "@zoonk/core/lesson-questions/earlier";
import { getLessonQuestionThread } from "@zoonk/core/lesson-questions/get-thread";
import { countCurrentUserMemory } from "@zoonk/core/memory/count";
import { getBuddyStatus } from "@zoonk/core/milestones/buddy";
import { countOpenGoalMistakes } from "@zoonk/core/mistakes/count-goal";
import { getSession } from "@zoonk/core/users/session";
import { BUDDY_COLUMN_CLASS, BuddyDaySkeleton } from "@zoonk/learn/buddy";
import { PageWithAside } from "@zoonk/learn/shell";
import { TutorComposerSkeleton } from "@zoonk/learn/tutor-composer";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { BuddyGoalStartClient } from "./buddy-goal-start-client";
import { BuddyPageClient } from "./buddy-page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Your buddy") };
}

async function findTutoredGoal() {
  const goalId = await getActiveGoalId();

  if (!goalId) {
    return null;
  }

  const owned = await getOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return null;
  }

  const { goal } = owned;
  return goal.status !== "archived" && goal.kind !== "explain" ? goal : null;
}

const NO_MESSAGES = { hasMore: false, nextCursor: null, questions: [] };

async function loadThread({ canAsk, goalId }: { canAsk: boolean; goalId: string }) {
  if (!canAsk) {
    return null;
  }

  const result = await getLessonQuestionThread({ target: { goalId, kind: "plan" } });

  if (result.status !== "ready") {
    return null;
  }

  return result.thread ?? NO_MESSAGES;
}

async function hasOpenMistake(goalId: string): Promise<boolean> {
  const result = await countOpenGoalMistakes({ goalId });
  return result.status === "ready" && result.open > 0;
}

async function BuddyContent() {
  const [readAt, result, goal, session, earlierQuestions, memoryCount] = await Promise.all([
    getReadAt(),
    getBuddyStatus({}),
    findTutoredGoal(),
    getSession(),
    hasEarlierQuestions(),
    countCurrentUserMemory(),
  ]);

  if (result.status !== "ready" || !session) {
    const t = await getExtracted();

    return (
      <AuthGatePage
        description={t("Your buddy answers your questions and adjusts your plan.")}
        next="/buddy"
        title={t("Your buddy")}
      />
    );
  }

  if (!goal) {
    return <BuddyGoalStartClient hasEarlierQuestions={earlierQuestions} status={result.buddy} />;
  }

  const canAsk = !session.user.isAnonymous;

  const [hasMistake, thread] = await Promise.all([
    hasOpenMistake(goal.id),
    loadThread({ canAsk, goalId: goal.id }),
  ]);

  return (
    <BuddyPageClient
      canAsk={canAsk}
      goalId={goal.id}
      hasEarlierQuestions={earlierQuestions}
      initialThread={thread}
      memoryCount={memoryCount ?? 0}
      readAt={readAt}
      situation={{ hasMistake, hasToday: Boolean(result.buddy.today) }}
      status={result.buddy}
      viewerId={session.user.id}
    />
  );
}

function BuddySkeleton({ dayLabel }: { dayLabel: string }) {
  return (
    <PageWithAside
      aside={<BuddyDaySkeleton />}
      asideClassName="hidden"
      asideLabel={dayLabel}
      className="flex-1"
    >
      <div className={BUDDY_COLUMN_CLASS}>
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-7 w-24 rounded-md min-[72rem]:hidden" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <div className="mt-auto flex flex-col gap-2.5 pt-6 pb-3 lg:pb-6">
          <Skeleton className="h-6.5 w-4/5 rounded-md" />
          <TutorComposerSkeleton />
        </div>
      </div>
    </PageWithAside>
  );
}

export default async function BuddyPage() {
  const t = await getExtracted();

  return (
    <Suspense fallback={<BuddySkeleton dayLabel={t("Your day")} />}>
      <BuddyContent />
    </Suspense>
  );
}
