"use client";

import { saveBuddyAction } from "@/app/[lang]/(settings)/settings/appearance/actions";
import { getCourseHref } from "@/data/courses/course-href";
import { useRouter } from "@/i18n/navigation";
import { useStartLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { getTutorConfig } from "@/lib/learn/tutor-config";
import { useRefreshWhenOld } from "@/lib/learn/use-refresh-when-old";
import { MOCK_ENTRY_HREFS } from "@/lib/mocks/mock-entry-hrefs";
import { getGoalStartHref } from "@/lib/public/public-hrefs";
import { useStartTestOut } from "@/lib/test-out/use-start-test-out";
import { type LessonQuestionThreadResource } from "@zoonk/core/lesson-questions/contract";
import {
  BuddyScreen,
  type BuddyScreenActions,
  type BuddyScreenHrefs,
  type BuddyStatusView,
  type TutorSituation,
  useBuddyTutor,
} from "@zoonk/learn/buddy";
import { TutorConversation } from "@zoonk/player/tutor/conversation";
import { useMemo } from "react";
import { answerPlanChangeAction } from "../journey/journey-actions";

const HREFS: BuddyScreenHrefs = { energy: "/energy", logbook: "/logbook" };

/**
 * Where each feature the buddy offers opens. Choosing where to focus is the Journey with its
 * "Choose where to focus" sheet open; a written test is its subject's page.
 */
const TOOL_HREFS: BuddyScreenActions["tools"]["hrefs"] = {
  chooseFocus: "/journey?focus=choose",
  chooseMock: MOCK_ENTRY_HREFS.choose,
  course: ({ brandSlug, slug }) => getCourseHref({ brandSlug, courseSlug: slug }),
  logbook: "/logbook",
  memory: "/settings/memory",
  mistakes: "/mistakes",
  pronunciation: "/pronunciation",
  startGoal: getGoalStartHref,
  stats: "/stats",
  subject: (key) => `/journey/${key}`,
};

/** What the conversation shows at once: the newest messages and where the earlier ones continue. */
type ThreadPage = Pick<LessonQuestionThreadResource, "hasMore" | "nextCursor" | "questions">;

/** The goal's conversation with the buddy, as the buddy screen describes it. */
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
  // The conversation names the buddy from the screen's own identity, which follows edits live.
  const tutor = useMemo(() => getTutorConfig({ buddy: null, canAsk }), [canAsk]);

  return (
    <TutorConversation goalId={goalId} initialThread={initialThread} tutor={tutor} {...content} />
  );
}

/**
 * The buddy saves as Appearance does, so both stay in step; a saved change refreshes the page, so
 * the tab bar's face and name follow it. The conversation is the goal's tutor thread over the
 * public API, and a plan change it proposes is answered as the Journey answers one, then the page
 * reads the buddy's day again.
 */
export function BuddyPageClient({
  canAsk,
  goalId,
  initialThread,
  readAt,
  situation,
  status,
}: {
  canAsk: boolean;
  /** The goal the buddy tutors. */
  goalId: string;
  /** The conversation as the page read it, shown at once and read again in the background. */
  initialThread: ThreadPage | null;
  /** When the page read the buddy's day (`getReadAt`), to read it again from an old copy. */
  readAt: number;
  situation: TutorSituation;
  status: BuddyStatusView;
}) {
  const router = useRouter();
  const startTestOut = useStartTestOut();
  const startConversation = useStartLanguageConversation();
  useRefreshWhenOld(readAt);

  return (
    <BuddyScreen
      actions={{
        decidePlanChange: async ({ changeId, status: decision }) => {
          const answered = await answerPlanChangeAction(goalId, { changeId, status: decision });

          if (answered) {
            router.refresh();
          }

          return answered;
        },
        saveBuddy: async (buddy) => {
          const saved = await saveBuddyAction(buddy);

          if (saved) {
            router.refresh();
          }

          return saved;
        },
        tools: {
          hrefs: TOOL_HREFS,
          startConversation: ({ chapterId, goalId: callGoalId, minutes }) =>
            startConversation({ chapterId, goalId: callGoalId, kind: "practice", minutes }),
          startTestOut,
        },
      }}
      hrefs={HREFS}
      situation={situation}
      status={status}
    >
      <BuddyConversation canAsk={canAsk} goalId={goalId} initialThread={initialThread} />
    </BuddyScreen>
  );
}
