"use client";

import { saveBuddyAction } from "@/app/[lang]/(app)/(settings)/settings/appearance/actions";
import { useRouter } from "@/i18n/navigation";
import { useReportTabMissions } from "@/lib/learn/tab-missions-provider";
import { getTutorConfig } from "@/lib/learn/tutor-config";
import { useRefreshOnPlanChange } from "@/lib/learn/use-refresh-on-plan-change";
import { useRefreshWhenOld } from "@/lib/learn/use-refresh-when-old";
import { useTutorAppLinks } from "@/lib/learn/use-tutor-app-links";
import { useTutorCardActions } from "@/lib/learn/use-tutor-cards";
import { useMissionLinks } from "@/lib/session/use-study-navigation";
import { type LessonQuestionThreadResource } from "@zoonk/core/lesson-questions/contract";
import {
  BuddyScreen,
  type BuddyScreenHrefs,
  type BuddyStatusView,
  type TutorSituation,
  useBuddyTutor,
} from "@zoonk/learn/buddy";
import { TutorConversation } from "@zoonk/player/tutor/conversation";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

const HREFS: BuddyScreenHrefs = {
  energy: "/energy",
  logbook: "/logbook",
  memory: "/settings/memory",
};

const WITH_EARLIER_QUESTIONS: BuddyScreenHrefs = {
  ...HREFS,
  earlierQuestions: "/buddy/earlier-questions",
};

/** What the conversation shows at once: the newest messages and where the earlier ones continue. */
type ThreadPage = Pick<LessonQuestionThreadResource, "hasMore" | "nextCursor" | "questions">;

/**
 * The goal's conversation with the buddy, as the buddy screen describes it. A question asked from
 * search (`?ask=`) waits in its composer: only the learner's own send asks it.
 */
function BuddyConversation({
  canAsk,
  goalId,
  initialThread,
}: {
  canAsk: boolean;
  goalId: string;
  initialThread: ThreadPage | null;
}) {
  const content = useBuddyTutor();
  const router = useRouter();
  const appLinks = useTutorAppLinks(goalId);

  // The conversation names the buddy from the screen's own identity, which follows edits live.
  const tutor = useMemo(
    () => getTutorConfig({ appLinks, buddy: null, canAsk }),
    [appLinks, canAsk],
  );

  const question = useSearchParams().get("ask") ?? undefined;

  return (
    <TutorConversation
      draft={question}
      goalId={goalId}
      initialThread={initialThread}
      // A question that completed a mission moves the buddy's day: read it again.
      onMissionMoment={() => router.refresh()}
      tutor={tutor}
      {...content}
    />
  );
}

/**
 * The buddy saves as Appearance does, so both stay in step; a saved change refreshes the page, so
 * the tab bar's face and name follow it. The conversation is the goal's tutor thread over the
 * public API, and a plan change it proposes is answered as the Plan answers one, then the page
 * reads the buddy's day again.
 */
export function BuddyPageClient({
  canAsk,
  goalId,
  hasEarlierQuestions,
  initialThread,
  memoryCount,
  readAt,
  situation,
  status,
  viewerId,
}: {
  canAsk: boolean;
  /** The goal the buddy tutors. */
  goalId: string;
  /** Whether the learner asked questions in an earlier version of their courses, to reread. */
  hasEarlierQuestions: boolean;
  /** The conversation as the page read it, shown at once and read again in the background. */
  initialThread: ThreadPage | null;
  memoryCount: number;
  /** When the page read the buddy's day (`getReadAt`), to read it again from an old copy. */
  readAt: number;
  situation: TutorSituation;
  status: BuddyStatusView;
  /** The learner the page read the buddy's day for, whose missions the tab may show. */
  viewerId: string;
}) {
  const router = useRouter();
  const { decide, tools } = useTutorCardActions(goalId);
  const missionLinks = useMissionLinks(goalId);
  // The buddy's day (its missions, the energy they spent) moves with the goal's sessions.
  const refreshIfChanged = useRefreshOnPlanChange({ goalId, readAt, watch: "today" });
  useRefreshWhenOld(readAt, refreshIfChanged);

  useReportTabMissions({
    day: status.today && { goalId: status.today.goalId, localDate: status.today.localDate },
    missions: status.today?.missions ?? null,
    readAt,
    userId: viewerId,
  });

  return (
    <BuddyScreen
      actions={{
        decidePlanChange: decide,
        missionLinks,
        saveBuddy: async (buddy) => {
          const saved = await saveBuddyAction(buddy);

          if (saved) {
            router.refresh();
          }

          return saved;
        },
        tools,
      }}
      hrefs={hasEarlierQuestions ? WITH_EARLIER_QUESTIONS : HREFS}
      memoryCount={memoryCount}
      situation={situation}
      status={status}
    >
      <BuddyConversation canAsk={canAsk} goalId={goalId} initialThread={initialThread} />
    </BuddyScreen>
  );
}
