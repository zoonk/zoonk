"use client";

import { type LessonQuestionThreadResource } from "@zoonk/core/lesson-questions/contract";
import { useBuddyTutor } from "@zoonk/learn/buddy";
import { TutorConversationLog } from "@zoonk/player/tutor/conversation";

type ThreadPage = Pick<LessonQuestionThreadResource, "hasMore" | "nextCursor" | "questions">;

const NOTHING_ASKED: ThreadPage = { hasMore: false, nextCursor: null, questions: [] };

/**
 * What a buddy page draws inside the layout's conversation: the turns of the one its URL names, as
 * read on the server, or a blank one when it names none.
 */
export function BuddyLog({
  conversationId,
  thread = NOTHING_ASKED,
}: {
  conversationId?: string;
  thread?: ThreadPage | null;
}) {
  const content = useBuddyTutor();

  return (
    <TutorConversationLog
      conversationId={conversationId}
      greeting={content.greeting}
      greetingAction={content.greetingAction}
      identity={content.identity}
      renderPlanChange={content.renderPlanChange}
      renderToolOffer={content.renderToolOffer}
      thread={thread}
    />
  );
}
