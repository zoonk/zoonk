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
import { TutorConversation } from "@zoonk/player/tutor/conversation";
import { useSearchParams } from "next/navigation";
import { type BuddyPageRead } from "./buddy-first-page";
import { useBuddyPages } from "./buddy-pages";
import { useBuddyConversations } from "./use-buddy-conversations";

const HREFS: BuddyHrefs = { energy: "/energy", logbook: "/logbook", memory: "/settings/memory" };

type ThreadPage = ReturnType<ReturnType<typeof useBuddyPages>["readOf"]>;

const NOTHING_ASKED: NonNullable<ThreadPage> = { hasMore: false, nextCursor: null, questions: [] };

/** A question from search (`?ask=`) waits in the composer: only the learner's own send asks it. */
function BuddyConversation({
  canAsk,
  conversationId,
  goalId,
  onQuestionSaved,
  thread,
}: {
  canAsk: boolean;
  conversationId: string;
  goalId: string;
  onQuestionSaved: (saved: { conversationId: string; question: LessonQuestionResource }) => void;
  thread: ThreadPage;
}) {
  const content = useBuddyTutor();
  const router = useRouter();
  const appLinks = useTutorAppLinks();

  const tutor = useTutorConfig({ appLinks, buddy: null, canAsk });

  const question = useSearchParams().get("ask") ?? undefined;

  return (
    <TutorConversation
      conversationId={conversationId}
      draft={question}
      goalId={goalId}
      onMissionMoment={() => router.refresh()}
      onQuestionSaved={onQuestionSaved}
      thread={thread}
      tutor={tutor}
      {...content}
    />
  );
}

export function BuddyClient({
  canAsk,
  conversations,
  firstPage,
  goalId,
  readAt,
  situation,
  status,
  viewerId,
}: {
  canAsk: boolean;
  /** Null for a guest, who can't ask and so has none. */
  conversations: BuddyConversations | null;
  /** What the page drawn with this layout read, in the same server render. */
  firstPage: BuddyPageRead | null;
  goalId: string;
  readAt: number;
  situation: TutorSituation;
  status: BuddyStatusView;
  viewerId: string;
}) {
  const router = useRouter();
  const { decide, tools } = useTutorCardActions(goalId);
  const missionLinks = useMissionLinks(goalId, { learner: viewerId });

  const pages = useBuddyPages(firstPage);

  const { list, open, questionSaved } = useBuddyConversations({
    goalId,
    isOfAnotherGoal: pages.isOfAnotherGoal,
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
        conversationId={open.id}
        goalId={goalId}
        onQuestionSaved={questionSaved}
        thread={open.blank ? NOTHING_ASKED : pages.readOf(open.id)}
      />
    </BuddyScreen>
  );
}
