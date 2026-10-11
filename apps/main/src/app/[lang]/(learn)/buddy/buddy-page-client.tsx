"use client";

import { saveBuddyAction } from "@/app/[lang]/(settings)/settings/appearance/actions";
import { useRouter } from "@/i18n/navigation";
import { getTutorConfig } from "@/lib/learn/tutor-config";
import { useRefreshWhenOld } from "@/lib/learn/use-refresh-when-old";
import { useTutorCardActions } from "@/lib/learn/use-tutor-cards";
import { type LessonQuestionThreadResource } from "@zoonk/core/lesson-questions/contract";
import {
  BuddyScreen,
  type BuddyScreenHrefs,
  type BuddyStatusView,
  type TutorSituation,
  useBuddyTutor,
} from "@zoonk/learn/buddy";
import { TutorConversation } from "@zoonk/player/tutor/conversation";
import { useMemo } from "react";

const HREFS: BuddyScreenHrefs = { energy: "/energy", logbook: "/logbook" };

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
  const { decide, tools } = useTutorCardActions(goalId);
  useRefreshWhenOld(readAt);

  return (
    <BuddyScreen
      actions={{
        decidePlanChange: decide,
        saveBuddy: async (buddy) => {
          const saved = await saveBuddyAction(buddy);

          if (saved) {
            router.refresh();
          }

          return saved;
        },
        tools,
      }}
      hrefs={HREFS}
      situation={situation}
      status={status}
    >
      <BuddyConversation canAsk={canAsk} goalId={goalId} initialThread={initialThread} />
    </BuddyScreen>
  );
}
