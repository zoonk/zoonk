import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../../../cache/tags";
import { settleCallTime } from "../../../entitlements/settle-call-time";
import { getLearnerTimeZone } from "../../../learner/_utils/goal-time-zone";
import { settleSessionDay } from "../../../sessions/_utils/settle-session-day";
import { withActivityMissionMoment } from "../../../sessions/missions/activity-mission-result";
import { settleLearnerMissions } from "../../../sessions/missions/settle-learner-missions";
import { settleMissions } from "../../../sessions/missions/settle-missions";
import { type LanguageConversationCompletionInput } from "../conversation-contract";
import { findOwnedConversation } from "../get-language-conversation";
import { withConversationAccess } from "./conversation-access";
import { toConversationView } from "./conversation-view";

/**
 * The call is committed and its time finalized before any mission or session reward can fail. Its
 * end also says what it did to the day's missions, the same on a retry.
 */
export async function finishConversationDay({
  conversationId,
  input,
  userId,
}: {
  conversationId: string;
  input: LanguageConversationCompletionInput;
  userId: string;
}) {
  const finished = await findOwnedConversation({ conversationId, userId });

  if (!finished) {
    return { status: "notFound" as const };
  }

  if (finished.row.status === "completed") {
    await settleCallTime({ conversationId, now: finished.row.endedAt ?? new Date(), userId });

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

    // A committed linked call can be retried after carry-over expires. Repair that owned day
    // with its durable source before source-less session finalization can pay its missions.
    if (block) {
      const zone = block.session.goal?.timezone ?? timeZone;
      await settleMissions({ sessionId: block.sessionId, source, timeZone: zone, userId });
      await settleSessionDay({ sessionId: block.sessionId, timeZone: zone, userId });
    }

    await settleLearnerMissions({ source, timeZone, userId });
    const conversation = await withConversationAccess(toConversationView(finished));
    revalidateCacheTags([getUserProgressCacheTag(userId)]);

    return conversation
      ? withActivityMissionMoment({
          result: { conversation, status: "completed" as const },
          source,
          timeZone,
          userId,
        })
      : { status: "notFound" as const };
  }

  const conversation = await withConversationAccess(toConversationView(finished));

  return conversation
    ? { conversation, missionMoment: null, status: "completed" as const }
    : { status: "notFound" as const };
}
