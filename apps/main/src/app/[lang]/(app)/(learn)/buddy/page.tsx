import { listBuddyConversations } from "@zoonk/core/lesson-questions/list-buddy-conversations";
import { type BuddyPageRead, handOverBuddyPage } from "./buddy-first-page";
import { canAskBuddy, findBuddyGoal, readBuddyConversation } from "./buddy-goal";
import { BuddyPage } from "./buddy-pages";

/** Today's conversation when the learner already asked something today, and a blank one otherwise. */
async function readCurrentConversation(): Promise<BuddyPageRead> {
  const [goal, canAsk] = await Promise.all([findBuddyGoal(), canAskBuddy()]);

  if (!goal || !canAsk) {
    return {};
  }

  const list = await listBuddyConversations({ goalId: goal.id });

  if (list.status !== "ready" || !list.currentId) {
    return {};
  }

  const thread = await readBuddyConversation({ conversationId: list.currentId, goalId: goal.id });

  return { conversationId: list.currentId, thread };
}

export default async function BuddyTabPage() {
  const page = await handOverBuddyPage(readCurrentConversation);
  return <BuddyPage {...page} />;
}
