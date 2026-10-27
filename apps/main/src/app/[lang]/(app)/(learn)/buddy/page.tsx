import { AuthGatePage } from "@/components/auth-gate";
import { FirstPaintContent } from "@/components/first-paint-content";
import { NextIntlClientProvider } from "@/i18n/intl-client-provider";
import { getClientMessages } from "@/i18n/messages";
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
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted, getLocale, getTimeZone } from "next-intl/server";
import { BuddyGoalStartClient } from "./buddy-goal-start-client";
import { BuddyPageClient } from "./buddy-page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Your buddy") };
}

/** The selected, non-archived goal the buddy tutors, unless it's a quick explanation. */
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
  const result = await countOpenGoalMistakes({ goalId });
  return result.status === "ready" && result.open > 0;
}

async function BuddyContent() {
  const [readAt, result, goal, session, earlierQuestions] = await Promise.all([
    getReadAt(),
    getBuddyStatus({}),
    findTutoredGoal(),
    getSession(),
    hasEarlierQuestions(),
  ]);

  // Someone without a session may have goals in their account: they log in and come back here.
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

  // The buddy tutors a goal: without one, it takes the learner's goal right here.
  if (!goal) {
    return <BuddyGoalStartClient hasEarlierQuestions={earlierQuestions} status={result.buddy} />;
  }

  const canAsk = !session.user.isAnonymous;
  const locale = await getLocale();
  const timeZone = await getTimeZone();

  const [hasMistake, thread, memoryCount, messages] = await Promise.all([
    hasOpenMistake(goal.id),
    loadThread({ canAsk, goalId: goal.id }),
    countCurrentUserMemory(),
    getClientMessages({ locale, scope: "player" }),
  ]);

  // The conversation is the lesson tutor's, so the tab needs the player's messages, read with the
  // rest: the content renders in one pass, as the first paint waits for its end.
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
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
    </NextIntlClientProvider>
  );
}

/**
 * The buddy's row, the start of its conversation and, on a wide screen, its day beside them, at
 * their size and place while the tab loads.
 */
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
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </PageWithAside>
  );
}

/**
 * The buddy tab: the learner's conversation with their buddy, their tutor for the goal (doubts,
 * the plan, and changes to it by talking), with the buddy's day (Energy and missions) a tap away
 * on a phone and beside the conversation on a wide screen. Before there's a goal, the buddy takes
 * one.
 */
export default async function BuddyPage() {
  const t = await getExtracted();

  return (
    <FirstPaintContent
      content={BuddyContent}
      fallback={<BuddySkeleton dayLabel={t("Your day")} />}
      id="buddy-ready"
    />
  );
}
