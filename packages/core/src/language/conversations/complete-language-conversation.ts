import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { isUuid } from "@zoonk/utils/uuid";
import { after } from "next/server";
import { getLearnerTimeZone } from "../../learner/_utils/goal-time-zone";
import { type MissionMomentView } from "../../sessions/completion-contract";
import { type ProgressCelebration } from "../../sessions/progress-celebration";
import { getSession } from "../../users/get-session";
import { trackCallCanDos } from "../units/can-do-events";
import { finishConversationDay } from "./_utils/finish-conversation-day";
import {
  type LanguageConversationCompletionInput,
  type LanguageConversationView,
} from "./conversation-contract";
import {
  type ConversationReviewInput,
  type ConversationReviewOutcome,
} from "./conversation-review";
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
        | "conversationEnded"
        | "retryable"
        | "takenOver";
    };

/** The durable runs that review completed calls: the API's Workflow runs. */
export type ConversationReviewRuns = {
  /** Whether the run ended without an outcome, so a new one may replace its claim. */
  failed: (runId: string) => Promise<boolean>;
  /** The run's outcome once it ends; rejects when the run failed. */
  outcome: (runId: string) => Promise<ConversationReviewOutcome>;
  /** Starts a run and returns its id. */
  start: (input: ConversationReviewInput) => Promise<string>;
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
 * The run reviewing this call: the one already claiming it, unless it failed, which a new run with
 * this request's transcript replaces. `started` is the run this request started, if any.
 */
async function findReviewRun({
  input,
  reviewRunId,
  runs,
}: {
  input: ConversationReviewInput;
  reviewRunId: string | null;
  runs: ConversationReviewRuns;
}): Promise<{ runId: string; started: boolean }> {
  if (reviewRunId && !(await runs.failed(reviewRunId))) {
    return { runId: reviewRunId, started: false };
  }

  const runId = await runs.start(reviewRunId ? { ...input, replaces: reviewRunId } : input);
  return { runId, started: true };
}

/** A run that found another run's claim waits for that one instead. */
async function waitForReview({
  runId,
  runs,
}: {
  runId: string;
  runs: ConversationReviewRuns;
}): Promise<{ outcome: ConversationReviewOutcome; runId: string }> {
  const outcome = await runs.outcome(runId);

  return outcome.status === "joined"
    ? { outcome: await runs.outcome(outcome.runId), runId: outcome.runId }
    : { outcome, runId };
}

/**
 * Ends a live call with what the app heard: the transcript, whether Help was used, and the time
 * spoken. A durable run reviews it (`ConversationReviewRuns`): it claims the call, so no new
 * connection starts, hangs it up, has a separate text model read the transcript (the goals met and
 * the feedback; the transcript isn't stored) and settles the call: Brain Power, today's progress
 * and, as a language goal's checkpoint, the unit when won. A review that keeps failing completes
 * the call without feedback; a run that fails anyway answers `retryable`, and trying again starts
 * a new run with the transcript sent again. Its end says what it did to the day's missions. Ending
 * it again returns the same result. A call that never connected ends without a review.
 */
export async function completeLanguageConversation({
  conversationId,
  input,
  runs,
}: {
  conversationId: string;
  input: LanguageConversationCompletionInput;
  runs: ConversationReviewRuns;
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

  const { connected, spokenSeconds, turns } = readCallRun({ input, row: owned.row });

  const { runId, started } = await findReviewRun({
    input: {
      connectionId: input.connectionId,
      conversationId,
      spokenSeconds,
      timeZone: await getLearnerTimeZone({ timeZone: input.timeZone, userId }),
      turns,
      usedHelp: input.usedHelp,
      userId,
    },
    reviewRunId: owned.row.reviewRunId,
    runs,
  });

  const reviewed = await safeAsync(() => waitForReview({ runId, runs }));

  if (reviewed.error) {
    return { status: "retryable" };
  }

  const { outcome } = reviewed.data;

  if (outcome.status === "joined") {
    return { status: "retryable" };
  }

  if (outcome.status !== "completed") {
    return { status: outcome.status };
  }

  // Only the request whose run settled the call starts what follows it.
  if (started && reviewed.data.runId === runId && outcome.progress) {
    startFollowUps({ connected, owned, userId, won: outcome.won });
  }

  return finishConversationDay({ conversationId, input, progress: outcome.progress, userId });
}
