import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../../../cache/tags";
import { getLearnerTimeZone } from "../../../learner/_utils/goal-time-zone";
import { celebrateProgress } from "../../../milestones/celebrate-progress";
import { type ProgressChange } from "../../../sessions/_utils/session-progress";
import { settleSessionDay } from "../../../sessions/_utils/settle-session-day";
import { withActivityMissionMoment } from "../../../sessions/missions/activity-mission-result";
import { settleLearnerMissions } from "../../../sessions/missions/settle-learner-missions";
import { settleMissions } from "../../../sessions/missions/settle-missions";
import { NOTHING_REACHED } from "../../../sessions/reached";
import { type LanguageConversationCompletionInput } from "../conversation-contract";
import { findOwnedConversation } from "../get-language-conversation";
import { withConversationAccess } from "./conversation-access";
import { toConversationView } from "./conversation-view";

/** The call commits before mission or session rewards; retrying can repair those rewards. */
export async function finishConversationDay({
  conversationId,
  input,
  progress = null,
  userId,
}: {
  conversationId: string;
  input: LanguageConversationCompletionInput;
  progress?: { brainPower: ProgressChange; energy: ProgressChange } | null;
  userId: string;
}) {
  const finished = await findOwnedConversation({ conversationId, userId });

  if (!finished) {
    return { status: "notFound" as const };
  }

  if (finished.row.status === "completed") {
    const timeZone = await getLearnerTimeZone({ timeZone: input.timeZone, userId });
    const source = { id: conversationId, kind: "conversation" };

    const block = finished.row.studyBlockId
      ? await prisma.studySessionBlock.findFirst({
          select: {
            session: { select: { goal: { select: { timezone: true } } } },
            sessionId: true,
          },
          where: { id: finished.row.studyBlockId, session: { userId } },
        })
      : null;

    const celebration = await celebrateProgress({
      progress,
      settleDay: async () => {
        const zone = block?.session.goal?.timezone ?? timeZone;

        const blockDay = block
          ? await settleMissions({ sessionId: block.sessionId, source, timeZone: zone, userId })
          : null;

        if (block) {
          await settleSessionDay({ sessionId: block.sessionId, timeZone: zone, userId });
        }

        const learnerDay = await settleLearnerMissions({ source, timeZone, userId });
        return blockDay?.fullMealPaid ? blockDay : learnerDay;
      },
      userId,
    });

    const conversation = await withConversationAccess(toConversationView(finished));
    revalidateCacheTags([getUserProgressCacheTag(userId)]);

    return conversation
      ? withActivityMissionMoment({
          result: { ...celebration, conversation, status: "completed" as const },
          source,
          timeZone,
          userId,
        })
      : { status: "notFound" as const };
  }

  const conversation = await withConversationAccess(toConversationView(finished));

  return conversation
    ? {
        ceremony: null,
        conversation,
        missionMoment: null,
        reached: NOTHING_REACHED,
        status: "completed" as const,
      }
    : { status: "notFound" as const };
}
