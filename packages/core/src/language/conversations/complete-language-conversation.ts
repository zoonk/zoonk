import "server-only";
import { randomUUID } from "node:crypto";
import { safeAsync } from "@zoonk/utils/error";
import { isUuid } from "@zoonk/utils/uuid";
import { after } from "next/server";
import { getLearnerTimeZone } from "../../learner/_utils/goal-time-zone";
import { type MissionMomentView } from "../../sessions/completion-contract";
import { type ProgressCelebration } from "../../sessions/progress-celebration";
import { getSession } from "../../users/get-session";
import { trackCallCanDos } from "../units/can-do-events";
import { claimConversationReview } from "./_utils/claim-conversation-review";
import { reviewConversationCall, settleConversationReview } from "./_utils/conversation-review";
import { finishConversationDay } from "./_utils/finish-conversation-day";
import {
  type LanguageConversationCompletionInput,
  type LanguageConversationView,
} from "./conversation-contract";
import { endLiveCall } from "./end-live-call";
import { type OwnedConversation, findOwnedConversation } from "./get-language-conversation";
import { prepareSpeakingMock } from "./prepare-language-calls";

/** A call can run a little past its length while the character says goodbye. */
const OVERTIME_SECONDS = 60;
const SECONDS_PER_MINUTE = 60;

export type CompleteLanguageConversationResult =
  | (ProgressCelebration & {
      conversation: LanguageConversationView;
      missionMoment: MissionMomentView | null;
      status: "completed";
    })
  | {
      status:
        | "invalid"
        | "notFound"
        | "unauthorized"
        | "previousConnectionClosing"
        | "conversationEnded"
        | "takenOver";
    };

/**
 * What the call ran: the learner's spoken time, capped at the call's length, and the turns to
 * review. A call that never connected held no call time, so nobody spoke in it: whatever turns a
 * client sends get no review, which would be model calls for a call that never happened.
 */
function readCallRun({
  input,
  row,
}: {
  input: LanguageConversationCompletionInput;
  row: OwnedConversation["row"];
}) {
  if (row.startedAt === null) {
    return { connected: false, spokenSeconds: 0, turns: [] };
  }

  const maxSeconds = row.minutes * SECONDS_PER_MINUTE + OVERTIME_SECONDS;

  return {
    connected: true,
    spokenSeconds: Math.min(input.spokenSeconds, maxSeconds),
    turns: input.turns,
  };
}

/**
 * What a finished call starts afterwards, once the learner has the result: a speaking mock that
 * was really taken gets the next one written ahead, at the level the call left, and a won
 * checkpoint records the unit's can-dos.
 */
function startFollowUps({
  connected,
  owned,
  userId,
  won,
}: {
  connected: boolean;
  owned: OwnedConversation;
  userId: string;
  won: boolean;
}) {
  const { chapterId, goalId, id, kind } = owned.row;

  if (connected && goalId && kind === "speakingMock") {
    after(() => prepareSpeakingMock({ goalId, userId }));
  }

  if (won && kind === "checkpoint") {
    after(() => trackCallCanDos({ chapterId, conversationId: id, goalId, userId }));
  }
}

/**
 * Ends a live call with what the app heard: the transcript, whether Help was used, and the time
 * spoken. The call's review is claimed first, so no new connection starts; its connection is hung
 * up, a separate text model reads the transcript (the goals met and the feedback; the transcript
 * isn't stored), and the call pays Brain Power, counts toward today and, as a language goal's
 * checkpoint, closes the unit when won. Its end says what it did to the day's missions. Ending it
 * again returns the same result. A call that never connected ends without a review.
 */
export async function completeLanguageConversation({
  conversationId,
  input,
}: {
  conversationId: string;
  input: LanguageConversationCompletionInput;
}): Promise<CompleteLanguageConversationResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const owned = await findOwnedConversation({ conversationId, userId });

  if (!owned || !isUuid(input.connectionId)) {
    return { status: "notFound" };
  }

  if (owned.row.status === "completed") {
    return finishConversationDay({ conversationId, input, userId });
  }

  const runId = randomUUID();

  const claim = await claimConversationReview({
    connectionId: input.connectionId,
    conversationId,
    runId,
    userId,
  });

  if (claim.status === "completed") {
    return finishConversationDay({ conversationId, input, userId });
  }

  if (claim.status === "joined") {
    return { status: "previousConnectionClosing" };
  }

  if (claim.status !== "owner") {
    return claim;
  }

  // Feedback doesn't depend on the hangup: one that fails is left to the deadline run.
  await safeAsync(() => endLiveCall({ connectionId: input.connectionId, reason: "completion" }));

  const { connected, spokenSeconds, turns } = readCallRun({ input, row: owned.row });
  const review = await reviewConversationCall({ conversationId, spokenSeconds, turns, userId });

  const settled = await settleConversationReview({
    conversationId,
    review,
    reviewRunId: runId,
    spokenSeconds,
    timeZone: await getLearnerTimeZone({ timeZone: input.timeZone, userId }),
    usedHelp: input.usedHelp,
    userId,
  });

  if (settled) {
    startFollowUps({ connected, owned, userId, won: settled.won });
  }

  return finishConversationDay({
    conversationId,
    input,
    progress: settled?.progress ?? null,
    userId,
  });
}
