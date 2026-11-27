import { getAppLocale } from "@/i18n/locale";
import { redirect } from "@/i18n/navigation";
import { getBuddyConversationGoalId } from "@zoonk/core/lesson-questions/get-buddy-conversation-goal";
import { getFormattingLocale } from "@zoonk/utils/locale";
import { notFound } from "next/navigation";
import { findBuddyGoal, readBuddyConversation } from "../buddy-goal";
import { ProvideBuddyThread } from "../buddy-threads";

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

  // The page around the conversation (its list, the day's missions) is the active goal's, so a
  // conversation of another goal, such as the one left open when the learner switched goals, gives
  // way to the active goal's own.
  if (goalId !== goal?.id) {
    const locale = await getAppLocale();
    redirect({ href: "/buddy", locale: getFormattingLocale(locale) });
  }

  const thread = await readBuddyConversation({ conversationId, goalId });

  return <ProvideBuddyThread conversationId={conversationId} thread={thread} />;
}
