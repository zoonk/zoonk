import "server-only";
import { recordLiveConversationUsage } from "@zoonk/ai/tasks/v2/language/live-conversation-usage";
import { isCefrLevel, parseCefrScore } from "@zoonk/utils/cefr";
import { after } from "next/server";
import { type AnalyticsEvent } from "../../analytics/events";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../../cache/tags";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getSession } from "../../users/get-session";
import { recordLanguageSkillEvidence } from "../levels/record-language-evidence";
import { trackCallCanDos } from "../units/can-do-events";
import { reviewConversation } from "./_utils/conversation-feedback";
import { readSavedScenario, toConversationView } from "./_utils/conversation-view";
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
  | { conversation: LanguageConversationView; status: "completed" }
  | { status: "invalid" | "notFound" | "unauthorized" };

const LEDGER_KIND = {
  checkpoint: "checkpoint",
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
 * closes the unit when won. The speaking level gets the call as evidence. A finished speaking mock
 * gets the next one written ahead, so another try starts at once. Ending it again returns the same
 * result.
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

  if (!owned) {
    return { status: "notFound" };
  }

  const scenario = readSavedScenario(owned.row);
  const { level } = owned.row;

  if (!scenario || !isCefrLevel(level)) {
    return { status: "invalid" };
  }

  if (owned.row.status === "ready") {
    const spokenSeconds = Math.min(
      input.spokenSeconds,
      owned.row.minutes * SECONDS_PER_MINUTE + OVERTIME_SECONDS,
    );

    const { feedback, objectivesMet } = await reviewConversation({
      level,
      row: owned.row,
      scenario,
      spokenSeconds,
      turns: input.turns,
      userId,
    });

    const settled = await settleConversation({
      bossKind: owned.bossKind,
      feedback,
      objectives: scenario.objectives.length,
      objectivesMet,
      row: owned.row,
      spokenSeconds,
      timeZone: getAnswerTimeZone({ goal: null, timeZone: input.timeZone }),
      usedHelp: input.usedHelp,
      userId,
    });

    const won = hasPassedConversation({
      objectives: scenario.objectives.length,
      objectivesMet: objectivesMet.length,
    });

    if (settled) {
      await Promise.all([
        spokenSeconds > 0 &&
          recordLanguageSkillEvidence({
            evidence: {
              ceiling: parseCefrScore(level) ?? 0,
              correct: objectivesMet.length,
              total: scenario.objectives.length,
            },
            language: owned.row.targetLanguage,
            skill: "speaking",
            userId,
          }),
        trackCall({
          objectives: scenario.objectives.length,
          objectivesMet: objectivesMet.length,
          owned,
          spokenSeconds,
          userId,
          won,
        }),
        input.voiceSeconds &&
          recordLiveConversationUsage({
            analytics: {
              contentScope: "personal",
              distinctId: userId,
              ...(owned.row.goalId ? { goalId: owned.row.goalId } : {}),
            },
            runId: owned.row.id,
            seconds: input.voiceSeconds,
          }),
      ]);
    }

    revalidateCacheTags([getUserProgressCacheTag(userId)]);

    const { goalId } = owned.row;

    // After the speaking evidence, so the next mock is written at the level it leaves.
    if (settled && goalId && owned.row.kind === "speakingMock") {
      after(() => prepareSpeakingMock({ goalId, userId }));
    }

    if (settled && won && owned.row.kind === "checkpoint") {
      after(() =>
        trackCallCanDos({
          chapterId: owned.row.chapterId,
          conversationId: owned.row.id,
          goalId: owned.row.goalId,
          userId,
        }),
      );
    }
  }

  const finished = await findOwnedConversation({ conversationId, userId });
  const conversation = finished ? toConversationView(finished) : null;

  return conversation ? { conversation, status: "completed" } : { status: "notFound" };
}
