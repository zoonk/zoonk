"use client";

import { saveBuddyAction } from "@/app/[lang]/(app)/(settings)/settings/appearance/actions";
import { useRouter } from "@/i18n/navigation";
import { useReportTabMissions } from "@/lib/learn/tab-missions-provider";
import { getTutorConfig } from "@/lib/learn/tutor-config";
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

type ThreadPage = Pick<LessonQuestionThreadResource, "hasMore" | "nextCursor" | "questions">;

/** A question from search (`?ask=`) waits in the composer: only the learner's own send asks it. */
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
      onMissionMoment={() => router.refresh()}
      tutor={tutor}
      {...content}
    />
  );
}

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
  goalId: string;
  hasEarlierQuestions: boolean;
  initialThread: ThreadPage | null;
  memoryCount: number;
  readAt: number;
  situation: TutorSituation;
  status: BuddyStatusView;
  viewerId: string;
}) {
  const router = useRouter();
  const { decide, tools } = useTutorCardActions(goalId);
  const missionLinks = useMissionLinks(goalId);

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
