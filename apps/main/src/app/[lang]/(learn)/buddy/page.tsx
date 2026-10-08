import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { getReadAt } from "@/lib/learn/read-at";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { getLessonQuestionThread } from "@zoonk/core/lesson-questions/get-thread";
import { getBuddyStatus } from "@zoonk/core/milestones/buddy";
import { listCurrentUserMistakes } from "@zoonk/core/mistakes/list-current-user";
import { getSession } from "@zoonk/core/users/session";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { LearnNoGoal } from "../_components/learn-no-goal";
import { BuddyPageClient } from "./buddy-page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Your buddy") };
}

/** The goal the buddy tutors: the active one, unless it's a quick explanation. */
async function findTutoredGoal() {
  const list = await listCurrentUserGoals();
  const goal = list?.goals.find((candidate) => candidate.id === list.activeGoalId) ?? null;
  return goal && goal.kind !== "explain" ? goal : null;
}

/** A conversation not started yet: the tab opens to the greeting and the suggestions. */
const NO_MESSAGES = { hasMore: false, nextCursor: null, questions: [] };

/**
 * The conversation as it stands, so the tab opens with it instead of a wait. Guests and visitors
 * can't talk to the buddy, so there's none to read; one that can't be read loads on screen.
 */
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

/** Whether the learner has an open mistake in the goal, for a first suggestion. */
async function hasOpenMistake(goalId: string): Promise<boolean> {
  const result = await listCurrentUserMistakes({ goalId, limit: 1, offset: 0, status: "open" });
  return result.status === "ready" && result.counts.open > 0;
}

async function BuddyContent() {
  const [result, goal, session] = await Promise.all([
    getBuddyStatus({}),
    findTutoredGoal(),
    getSession(),
  ]);

  // The buddy tutors a goal: without one, the tab's one next step is setting one, as the other tabs say.
  if (result.status !== "ready" || !goal) {
    return <LearnNoGoal />;
  }

  const canAsk = Boolean(session && !session.user.isAnonymous);

  const [hasMistake, thread, readAt] = await Promise.all([
    hasOpenMistake(goal.id),
    loadThread({ canAsk, goalId: goal.id }),
    getReadAt(),
  ]);

  // The conversation is the lesson tutor's, so the tab needs the player's messages.
  return (
    <ClientMessagesProvider scope="player">
      <BuddyPageClient
        canAsk={canAsk}
        goalId={goal.id}
        initialThread={thread}
        readAt={readAt}
        situation={{ hasMistake, hasToday: Boolean(result.buddy.today) }}
        status={result.buddy}
      />
    </ClientMessagesProvider>
  );
}

function BuddySkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-8 w-44 rounded-full" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
      </div>
    </div>
  );
}

/**
 * The buddy tab: the learner's conversation with their buddy, their tutor for the goal (doubts,
 * the plan, and changes to it by talking), with the buddy's Energy and missions kept to one line.
 */
export default function BuddyPage() {
  return (
    <Suspense fallback={<BuddySkeleton />}>
      <BuddyContent />
    </Suspense>
  );
}
