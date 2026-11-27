"use client";

import { saveBuddyAction } from "@/app/[lang]/(app)/(settings)/settings/appearance/actions";
import { useRouter } from "@/i18n/navigation";
import { useReportTabMissions } from "@/lib/learn/tab-missions-provider";
import { useTutorConfig } from "@/lib/learn/tutor-config";
import { useTutorAppLinks } from "@/lib/learn/use-tutor-app-links";
import { useTutorCardActions } from "@/lib/learn/use-tutor-cards";
import { useMissionLinks } from "@/lib/session/use-mission-links";
import {
  type BuddyConversations,
  type LessonQuestionResource,
} from "@zoonk/core/lesson-questions/contract";
import {
  type BuddyHrefs,
  BuddyScreen,
  type BuddyStatusView,
  type TutorSituation,
  useBuddyTutor,
} from "@zoonk/learn/buddy";
import { TutorConversationHost } from "@zoonk/player/tutor/conversation";
import { useSearchParams } from "next/navigation";
import { useBuddyConversations } from "./use-buddy-conversations";

const HREFS: BuddyHrefs = { energy: "/energy", logbook: "/logbook", memory: "/settings/memory" };

type OpenConversation = { blank: boolean; id: string };

/** A question from search (`?ask=`) waits in the composer: only the learner's own send asks it. */
function BuddyConversation({
  canAsk,
  children,
  conversation,
  goalId,
  onQuestionSaved,
}: {
  canAsk: boolean;
  children: React.ReactNode;
  conversation: OpenConversation;
  goalId: string;
  onQuestionSaved: (saved: { conversationId: string; question: LessonQuestionResource }) => void;
}) {
  const content = useBuddyTutor();
  const router = useRouter();
  const appLinks = useTutorAppLinks();

  const tutor = useTutorConfig({ appLinks, buddy: null, canAsk });

  const question = useSearchParams().get("ask") ?? undefined;

  return (
    <TutorConversationHost
      composerLabel={content.composerLabel}
      conversation={conversation}
      draft={question}
      goalId={goalId}
      identity={content.identity}
      onAnswered={content.onAnswered}
      onAsked={content.onAsked}
      onMissionMoment={() => router.refresh()}
      onQuestionSaved={onQuestionSaved}
      placeholder={content.placeholder}
      suggestions={content.suggestions}
      tutor={tutor}
    >
      {children}
    </TutorConversationHost>
  );
}

export function BuddyClient({
  canAsk,
  children,
  conversations,
  goalId,
  readAt,
  situation,
  status,
  viewerId,
}: {
  canAsk: boolean;
  children: React.ReactNode;
  /** Null for a guest, who can't ask and so has none. */
  conversations: BuddyConversations | null;
  goalId: string;
  readAt: number;
  situation: TutorSituation;
  status: BuddyStatusView;
  viewerId: string;
}) {
  const router = useRouter();
  const { decide, tools } = useTutorCardActions(goalId);
  const missionLinks = useMissionLinks(goalId, { learner: viewerId });

  const { list, open, questionSaved } = useBuddyConversations({
    goalId,
    read: conversations,
    readAt,
  });

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
      conversations={list}
      hrefs={HREFS}
      situation={situation}
      status={status}
    >
      <BuddyConversation
        canAsk={canAsk}
        conversation={open}
        goalId={goalId}
        onQuestionSaved={questionSaved}
      >
        {children}
      </BuddyConversation>
    </BuddyScreen>
  );
}
