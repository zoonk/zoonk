import { AuthGatePage } from "@/components/auth-gate";
import { getReadAt } from "@/lib/learn/read-at";
import { listBuddyConversations } from "@zoonk/core/lesson-questions/list-buddy-conversations";
import { getBuddyStatus } from "@zoonk/core/milestones/buddy";
import { countGoalMistakes } from "@zoonk/core/mistakes/count-goal";
import { getSession } from "@zoonk/core/users/session";
import { BuddyScreenSkeleton } from "@zoonk/learn/buddy";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { BuddyClient } from "./buddy-client";
import { readFirstBuddyPage } from "./buddy-first-page";
import { findBuddyGoal } from "./buddy-goal";
import { BuddyGoalStartClient } from "./buddy-goal-start-client";
import { BuddyPages } from "./buddy-pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Your buddy") };
}

async function hasGoalMistake(goalId: string): Promise<boolean> {
  const result = await countGoalMistakes({ goalId });
  return result.status === "ready" && result.open + result.fixed > 0;
}

async function readConversations({ canAsk, goalId }: { canAsk: boolean; goalId: string }) {
  if (!canAsk) {
    return null;
  }

  const list = await listBuddyConversations({ goalId });

  if (list.status !== "ready") {
    return { conversations: [], currentId: null, nextCursor: null };
  }

  const { conversations, currentId, nextCursor } = list;
  return { conversations, currentId, nextCursor };
}

/**
 * The whole screen is drawn here, and the page under it only hands over the conversation its URL
 * names (`handOverBuddyPage`). So opening another conversation, or a new one getting its own
 * address, changes the turns alone: the list, the composer and an answer on its way stay as they are.
 */
async function BuddyContent() {
  const [readAt, result, goal, session] = await Promise.all([
    getReadAt(),
    getBuddyStatus({}),
    findBuddyGoal(),
    getSession(),
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
    return <BuddyGoalStartClient status={result.buddy} />;
  }

  const canAsk = !session.user.isAnonymous;

  const [hasMistake, conversations, firstPage] = await Promise.all([
    hasGoalMistake(goal.id),
    readConversations({ canAsk, goalId: goal.id }),
    readFirstBuddyPage(),
  ]);

  return (
    <BuddyClient
      canAsk={canAsk}
      conversations={conversations}
      firstPage={firstPage}
      goalId={goal.id}
      key={goal.id}
      readAt={readAt}
      situation={{ hasMistake, hasToday: Boolean(result.buddy.today) }}
      status={result.buddy}
      viewerId={session.user.id}
    />
  );
}

/** The page is beside the screen, not inside it, so both are read at once and the page hands over. */
export default function BuddyLayout({ children }: LayoutProps<"/[lang]/buddy">) {
  return (
    <BuddyPages>
      <Suspense fallback={null}>{children}</Suspense>

      <Suspense fallback={<BuddyScreenSkeleton />}>
        <BuddyContent />
      </Suspense>
    </BuddyPages>
  );
}
