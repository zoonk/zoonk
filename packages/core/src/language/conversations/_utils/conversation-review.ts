import "server-only";
import { type CefrLevel, isCefrLevel, parseCefrScore } from "@zoonk/utils/cefr";
import { type AnalyticsEvent } from "../../../analytics/events";
import { trackLearnerEvents } from "../../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../../../cache/tags";
import { type ProgressChange } from "../../../sessions/_utils/session-progress";
import { getExamTaskEvidence } from "../../exam-speaking/speaking-evidence";
import { recordLanguageSkillEvidence } from "../../levels/record-language-evidence";
import { type LevelEvidence } from "../../levels/skill-level-rules";
import { type ConversationTurn } from "../conversation-contract";
import { hasPassedConversation } from "../conversation-rules";
import { type OwnedConversation, findOwnedConversation } from "../get-language-conversation";
import { type WrittenFeedback, reviewConversation } from "./conversation-feedback";
import { type SavedScenario, readSavedScenario } from "./conversation-view";
import { settleConversation } from "./settle-conversation";

/** What the review found: the goals met and the feedback, null when there's none to give. */
export type ConversationReview = { feedback: WrittenFeedback | null; objectivesMet: string[] };

export type SettledReview = {
  progress: { brainPower: ProgressChange; energy: ProgressChange };
  won: boolean;
};

type ReviewedCall = { level: CefrLevel; owned: OwnedConversation; scenario: SavedScenario };

async function loadReviewedCall({
  conversationId,
  userId,
}: {
  conversationId: string;
  userId: string;
}): Promise<ReviewedCall> {
  const owned = await findOwnedConversation({ conversationId, userId });
  const scenario = owned ? readSavedScenario(owned.row) : null;

  if (!owned || !scenario || !isCefrLevel(owned.row.level)) {
    throw new Error(`Conversation ${conversationId} can't be reviewed`);
  }

  return { level: owned.row.level, owned, scenario };
}

/**
 * Reads the call's transcript with a separate text model: the goals met (those marked during the
 * call plus any the full transcript shows) and the feedback. The transcript isn't stored.
 */
export async function reviewConversationCall({
  conversationId,
  spokenSeconds,
  turns,
  userId,
}: {
  conversationId: string;
  spokenSeconds: number;
  turns: ConversationTurn[];
  userId: string;
}): Promise<ConversationReview> {
  const { level, owned, scenario } = await loadReviewedCall({ conversationId, userId });

  return reviewConversation({ level, row: owned.row, scenario, spokenSeconds, turns, userId });
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
 * Writes the reviewed call once, for the run that claimed it (`settleConversation`): its feedback
 * or none, Brain Power and Energy, the ledger and a checkpoint's block, then the speaking level's
 * evidence and analytics. Null when the call was already settled.
 */
export async function settleConversationReview({
  conversationId,
  review,
  reviewRunId,
  spokenSeconds,
  timeZone,
  usedHelp,
  userId,
}: {
  conversationId: string;
  review: ConversationReview;
  reviewRunId: string;
  spokenSeconds: number;
  timeZone: string;
  usedHelp: boolean;
  userId: string;
}): Promise<SettledReview | null> {
  const { level, owned, scenario } = await loadReviewedCall({ conversationId, userId });
  const { feedback, objectivesMet } = review;

  const progress = await settleConversation({
    bossKind: owned.bossKind,
    feedback,
    objectives: scenario.objectives.length,
    objectivesMet,
    reviewRunId,
    row: owned.row,
    spokenSeconds,
    timeZone,
    usedHelp,
    userId,
  });

  if (!progress) {
    return null;
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

  return { progress, won };
}
