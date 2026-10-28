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

export type ConversationReviewRuns = {
  failed: (runId: string) => Promise<boolean>;
  /** Rejects when the review run failed. */
  outcome: (runId: string) => Promise<ConversationReviewOutcome>;
  start: (input: ConversationReviewInput) => Promise<string>;
};

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

  if (started && reviewed.data.runId === runId && outcome.progress) {
    startFollowUps({ connected, owned, userId, won: outcome.won });
  }

  return finishConversationDay({ conversationId, input, progress: outcome.progress, userId });
}
