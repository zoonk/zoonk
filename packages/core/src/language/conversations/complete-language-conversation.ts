import "server-only";
import { prisma } from "@zoonk/db";
import { type CefrLevel, isCefrLevel, parseCefrScore } from "@zoonk/utils/cefr";
import { isUuid } from "@zoonk/utils/uuid";
import { after } from "next/server";
import { type AnalyticsEvent } from "../../analytics/events";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../../cache/tags";
import { settleCallTime } from "../../entitlements/settle-call-time";
import { getLearnerTimeZone } from "../../learner/_utils/goal-time-zone";
import { type MissionMomentView } from "../../sessions/completion-contract";
import { type ProgressCelebration } from "../../sessions/progress-celebration";
import { getSession } from "../../users/get-session";
import { getExamTaskEvidence } from "../exam-speaking/speaking-evidence";
import { recordLanguageSkillEvidence } from "../levels/record-language-evidence";
import { type LevelEvidence } from "../levels/skill-level-rules";
import { trackCallCanDos } from "../units/can-do-events";
import { closeCompletingConversation } from "./_utils/close-completing-conversation";
import { hasCompletionReviewClaim } from "./_utils/completion-review-lease";
import { type WrittenFeedback, reviewConversation } from "./_utils/conversation-feedback";
import { type SavedScenario, readSavedScenario } from "./_utils/conversation-view";
import { finishConversationDay } from "./_utils/finish-conversation-day";
import { settleConversation } from "./_utils/settle-conversation";
import {
  type LanguageConversationCompletionInput,
  type LanguageConversationView,
} from "./conversation-contract";
import { hasPassedConversation } from "./conversation-rules";
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

async function readCompletedConversation({
  conversationId,
  input,
  owned,
  userId,
}: {
  conversationId: string;
  input: LanguageConversationCompletionInput;
  owned: OwnedConversation;
  userId: string;
}): Promise<CompleteLanguageConversationResult | null> {
  if (!isUuid(input.connectionId)) {
    return { status: "notFound" };
  }

  if (owned.row.status !== "completed") {
    return null;
  }

  const origin = await prisma.liveCallConnection.findFirst({
    where: { conversationId, id: input.connectionId, userId },
  });

  return origin ? finishConversationDay({ conversationId, input, userId }) : { status: "notFound" };
}

async function loadCompletionContext({
  conversationId,
  input,
  userId,
}: {
  conversationId: string;
  input: LanguageConversationCompletionInput;
  userId: string;
}) {
  const owned = await findOwnedConversation({ conversationId, userId });

  if (!owned) {
    return { status: "notFound" as const };
  }

  const completed = await readCompletedConversation({ conversationId, input, owned, userId });

  if (completed) {
    return completed;
  }

  const scenario = readSavedScenario(owned.row);
  const { level } = owned.row;

  if (!scenario || !isCefrLevel(level)) {
    return { status: "invalid" as const };
  }

  return { level, owned, scenario, status: "ready" as const };
}

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
 * What the call says about the learner's speaking: its goals met at the level it ran at, or an exam
 * task's criteria rated at the exam's level. A call where the learner said nothing says nothing.
 */
function getSpeakingEvidence({
  feedback,
  level,
  objectivesMet,
  scenario,
  spokenSeconds,
}: {
  feedback: WrittenFeedback | null;
  level: CefrLevel;
  objectivesMet: number;
  scenario: SavedScenario;
  spokenSeconds: number;
}): LevelEvidence | null {
  if (spokenSeconds === 0) {
    return null;
  }

  if (scenario.examTask) {
    return getExamTaskEvidence({
      feedback: feedback?.feedback.kind === "examSpeaking" ? feedback.feedback : null,
      snapshot: scenario.examTask,
    });
  }

  return {
    ceiling: parseCefrScore(level) ?? 0,
    correct: objectivesMet,
    total: scenario.objectives.length,
  };
}

const LEDGER_KIND = {
  checkpoint: "checkpoint",
  examSpeaking: "exam_speaking",
  practice: "practice",
  speakingMock: "speaking_mock",
} as const;

async function trackCall({
  objectives,
  objectivesMet,
  owned,
  spokenSeconds,
  userId,
  won,
}: {
  objectives: number;
  objectivesMet: number;
  owned: OwnedConversation;
  spokenSeconds: number;
  userId: string;
  won: boolean;
}) {
  const finished: AnalyticsEvent = {
    name: "Conversation Finished",
    properties: {
      conversation_kind: LEDGER_KIND[owned.row.kind],
      objectives,
      objectives_met: objectivesMet,
      spoken_seconds: spokenSeconds,
      target_language: owned.row.targetLanguage,
    },
  };

  const boss: AnalyticsEvent = {
    name: "Boss Finished",
    properties: { boss: "language", passed: won },
  };

  await trackLearnerEvents({
    events: owned.row.kind === "checkpoint" ? [finished, boss] : [finished],
    goalId: owned.row.goalId,
    locale: owned.row.language,
    userId,
  });
}

/**
 * Ends a live call with what the app heard: the transcript, whether Help was used, and the time
 * spoken. The objectives met are the ones marked during the call plus any the full transcript
 * shows, read by a separate text model that also writes the feedback; the transcript isn't
 * stored. The call pays Brain Power, counts toward today and, as a language goal's checkpoint,
 * closes the unit when won. The speaking level gets the call as evidence, and the day's call time
 * keeps only what the call ran. A finished speaking mock gets the next one written ahead, so
 * another try starts at once. Its end says what it did to the day's missions (a call can be one).
 * Ending it again returns the same result. A call that never connected ends without a review: only
 * connecting claims call time.
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
  const context = await loadCompletionContext({ conversationId, input, userId });

  if (context.status !== "ready") {
    return context;
  }

  const { level, owned, scenario } = context;

  if (owned.row.status === "ready") {
    const result = await closeCompletingConversation({
      connectionId: input.connectionId,
      conversationId,
      review: async (completionStartedAt) => {
        // When the call ended, before its review: the day's call time keeps only what it ran.
        const endedAt = new Date();

        const { connected, spokenSeconds, turns } = readCallRun({ input, row: owned.row });

        const reviewed = await reviewConversation({
          hasReviewClaim: () => hasCompletionReviewClaim({ completionStartedAt, conversationId }),
          level,
          row: owned.row,
          scenario,
          spokenSeconds,
          turns,
          userId,
        });

        if (!reviewed) {
          return { status: "previousConnectionClosing" as const };
        }

        const { feedback, objectivesMet } = reviewed;

        const settled = await settleConversation({
          bossKind: owned.bossKind,
          completionStartedAt,
          feedback,
          objectives: scenario.objectives.length,
          objectivesMet,
          row: owned.row,
          spokenSeconds,
          timeZone: await getLearnerTimeZone({ timeZone: input.timeZone, userId }),
          usedHelp: input.usedHelp,
          userId,
        });

        if (!settled) {
          const current = await loadCompletionContext({ conversationId, input, userId });

          return current.status === "ready"
            ? { status: "previousConnectionClosing" as const }
            : current;
        }

        const won = hasPassedConversation({
          objectives: scenario.objectives.length,
          objectivesMet: objectivesMet.length,
        });

        const evidence = getSpeakingEvidence({
          feedback,
          level,
          objectivesMet: objectivesMet.length,
          scenario,
          spokenSeconds,
        });

        await Promise.all([
          evidence &&
            recordLanguageSkillEvidence({
              evidence,
              language: owned.row.targetLanguage,
              skill: "speaking",
              userId,
            }),
          settleCallTime({ conversationId: owned.row.id, now: endedAt, userId }),
          trackCall({
            objectives: scenario.objectives.length,
            objectivesMet: objectivesMet.length,
            owned,
            spokenSeconds,
            userId,
            won,
          }),
        ]);

        revalidateCacheTags([getUserProgressCacheTag(userId)]);

        const { goalId } = owned.row;

        // After the speaking evidence, so the next mock is written at the level it leaves.
        // Only a mock that was really taken gets the next one written (a model call).
        if (connected && goalId && owned.row.kind === "speakingMock") {
          after(() => prepareSpeakingMock({ goalId, userId }));
        }

        if (won && owned.row.kind === "checkpoint") {
          after(() =>
            trackCallCanDos({
              chapterId: owned.row.chapterId,
              conversationId: owned.row.id,
              goalId: owned.row.goalId,
              userId,
            }),
          );
        }

        return finishConversationDay({ conversationId, input, progress: settled, userId });
      },
      userId,
    });

    if (result.status === "previousConnectionClosing") {
      const current = await loadCompletionContext({ conversationId, input, userId });
      return current.status === "ready" ? result : current;
    }

    return result;
  }

  return finishConversationDay({ conversationId, input, userId });
}
