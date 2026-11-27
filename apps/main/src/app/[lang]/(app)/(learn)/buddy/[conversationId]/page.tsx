import { getBuddyConversationGoalId } from "@zoonk/core/lesson-questions/get-buddy-conversation-goal";
import { getSession } from "@zoonk/core/users/session";
import { notFound } from "next/navigation";
import { type BuddyPageRead, handOverBuddyPage } from "../buddy-first-page";
import { findBuddyGoal, readBuddyConversation } from "../buddy-goal";
import { BuddyPage } from "../buddy-pages";

async function readConversationPage(conversationId: string): Promise<BuddyPageRead> {
  const [goalId, goal, session] = await Promise.all([
    getBuddyConversationGoalId(conversationId),
    findBuddyGoal(),
    getSession(),
  ]);

  // Signed out, the layout asks to log in before anything is said about the conversation.
  if (!session) {
    return {};
  }

  if (!goalId) {
    notFound();
  }

  // The screen around a conversation (its list, the day's missions) is the active goal's. So one
  // of another goal, such as the one left open when the learner switched goals, isn't opened: the
  // layout opens the active goal's own in its place.
  if (goalId !== goal?.id) {
    return { conversationId, ofAnotherGoal: true };
  }

  return { conversationId, thread: await readBuddyConversation({ conversationId, goalId }) };
}

export default async function BuddyConversationPage({
  params,
}: PageProps<"/[lang]/buddy/[conversationId]">) {
  const page = await handOverBuddyPage(async () => {
    const { conversationId } = await params;
    return readConversationPage(conversationId);
  });

  return <BuddyPage {...page} />;
}
