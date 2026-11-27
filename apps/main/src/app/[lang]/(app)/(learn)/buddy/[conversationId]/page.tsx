import { getBuddyConversationGoalId } from "@zoonk/core/lesson-questions/get-buddy-conversation-goal";
import { notFound } from "next/navigation";
import { findBuddyGoal, readBuddyConversation } from "../buddy-goal";
import { BuddyPage } from "../buddy-pages";

export default async function BuddyConversationPage({
  params,
}: PageProps<"/[lang]/buddy/[conversationId]">) {
  const { conversationId } = await params;

  const [goalId, goal] = await Promise.all([
    getBuddyConversationGoalId(conversationId),
    findBuddyGoal(),
  ]);

  if (!goalId) {
    notFound();
  }

  // The screen around a conversation (its list, the day's missions) is the active goal's. So one
  // of another goal, such as the one left open when the learner switched goals, isn't opened: the
  // layout opens the active goal's own in its place.
  if (goalId !== goal?.id) {
    return <BuddyPage conversationId={conversationId} ofAnotherGoal />;
  }

  const thread = await readBuddyConversation({ conversationId, goalId });

  return <BuddyPage conversationId={conversationId} thread={thread} />;
}
