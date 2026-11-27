import { listBuddyConversations } from "@zoonk/core/lesson-questions/list-buddy-conversations";
import { canAskBuddy, findBuddyGoal, readBuddyConversation } from "./buddy-goal";
import { BuddyPage } from "./buddy-pages";

/** Today's conversation when the learner already asked something today, and a blank one otherwise. */
async function readCurrentConversation() {
  const [goal, canAsk] = await Promise.all([findBuddyGoal(), canAskBuddy()]);

  if (!goal || !canAsk) {
    return null;
  }

  const list = await listBuddyConversations({ goalId: goal.id });

  if (list.status !== "ready" || !list.currentId) {
    return null;
  }

  const thread = await readBuddyConversation({ conversationId: list.currentId, goalId: goal.id });

  return { id: list.currentId, thread };
}

export default async function BuddyTabPage() {
  const current = await readCurrentConversation();

  return <BuddyPage conversationId={current?.id} thread={current?.thread} />;
}
