import "server-only";
import { type CefrLevel, isCefrLevel, parseCefrScore } from "@zoonk/utils/cefr";
import { type AnalyticsEvent } from "../../analytics/events";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../../cache/tags";
import { lockUsageForViewer } from "../../entitlements/_utils/usage-lock";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { type ProgressChange } from "../../sessions/_utils/session-progress";
import { getExamTaskEvidence } from "../exam-speaking/speaking-evidence";
import { recordLanguageSkillEvidence } from "../levels/record-language-evidence";
import { type LevelEvidence } from "../levels/skill-level-rules";
import { type WrittenFeedback, reviewConversation } from "./_utils/conversation-feedback";
import {
  type ConversationRow,
  type SavedScenario,
  readSavedScenario,
} from "./_utils/conversation-view";
import { settleConversation } from "./_utils/settle-conversation";
import { type ReviewClaim } from "./claim-conversation-review";
import { type ConversationTurn, conversationFeedbackSchema } from "./conversation-contract";
import { getMetObjectives, hasPassedConversation } from "./conversation-rules";
import { type OwnedConversation, findOwnedConversation } from "./get-language-conversation";

/** What the review found: the goals met and the feedback, null when there's none to give. */
export type ConversationReview = { feedback: WrittenFeedback | null; objectivesMet: string[] };

/**
 * A completed call's review run: what the learner's completion sent, already capped to what the
 * call ran, and the failed run it replaces when the learner tried again after one. The transcript
 * travels here and is never stored.
 */
export type ConversationReviewInput = {
  connectionId: string;
  conversationId: string;
  replaces?: string;
  spokenSeconds: number;
  timeZone: string;
  turns: ConversationTurn[];
  usedHelp: boolean;
  userId: string;
};

/**
 * How a review run ended: the call completed (with this run's Brain Power and Energy, or none when
 * another write had settled it), another run had the claim, or the claim was refused.
 */
export type ConversationReviewOutcome =
  | Exclude<ReviewClaim, { status: "owner" | "settled" }>
  | {
      progress: { brainPower: ProgressChange; energy: ProgressChange } | null;
      status: "completed";
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

/** A review this call already kept, so writing it again repeats no model call. */
function readKeptReview(row: ConversationRow): ConversationReview | null {
  const feedback = conversationFeedbackSchema.safeParse(row.feedback);

  if (!feedback.success || !row.generatedAt || !row.model || !row.promptVersion || !row.runId) {
    return null;
  }

  return {
    feedback: {
      feedback: feedback.data,
      provenance: {
        generatedAt: row.generatedAt,
        model: row.model,
        promptVersion: row.promptVersion,
        runId: row.runId,
      },
    },
    objectivesMet: row.objectivesMet,
  };
}

/**
 * Keeps the review on the call, still unsettled, for the run that claims it, so settling it again
 * (a step retry, or a new run after a failed one) never grades it twice.
 */
async function keepReview({
  conversationId,
  review,
  runId,
  userId,
}: {
  conversationId: string;
  review: ConversationReview;
  runId: string;
  userId: string;
}): Promise<void> {
  if (!review.feedback) {
    return;
  }

  const { feedback, provenance } = review.feedback;

  await writeLearnerChange({ userId }, async (transaction) => {
    await lockUsageForViewer({ transaction, userId });

    const { count } = await transaction.languageConversation.updateMany({
      data: { feedback, objectivesMet: review.objectivesMet, ...provenance },
      where: { id: conversationId, reviewRunId: runId, status: "ready" },
    });

    return count === 0 ? unchanged(null) : null;
  });
}

/**
 * Reads the call's transcript with a separate text model: the goals met (those marked during the
 * call plus any the full transcript shows) and the feedback. A grade takes seconds, so it runs
 * outside any transaction and is kept on the call before it settles; a review kept earlier is
 * used again. The transcript isn't stored. A model failure throws.
 */
export async function reviewConversationCall({
  conversationId,
  runId,
  spokenSeconds,
  turns,
  userId,
}: Pick<ConversationReviewInput, "conversationId" | "spokenSeconds" | "turns" | "userId"> & {
  runId: string;
}): Promise<ConversationReview> {
  const { level, owned, scenario } = await loadReviewedCall({ conversationId, userId });
  const kept = readKeptReview(owned.row);

  if (kept) {
    return kept;
  }

  const review = await reviewConversation({
    level,
    row: owned.row,
    scenario,
    spokenSeconds,
    turns,
    userId,
  });

  await keepReview({ conversationId, review, runId, userId });
  return review;
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
 * Writes the reviewed call once, for the run that claimed it (`settleConversation`): its feedback,
 * Brain Power and Energy, the ledger and a checkpoint's block, then the speaking level's evidence
 * and analytics. With no review (the model kept failing), the call completes without feedback,
 * with the goals marked during it.
 */
export async function settleConversationReview({
  conversationId,
  review,
  runId,
  spokenSeconds,
  timeZone,
  usedHelp,
  userId,
}: Omit<ConversationReviewInput, "connectionId" | "turns"> & {
  review: ConversationReview | null;
  runId: string;
}): Promise<ConversationReviewOutcome> {
  const { level, owned, scenario } = await loadReviewedCall({ conversationId, userId });

  const { feedback, objectivesMet } = review ?? {
    feedback: null,
    objectivesMet: getMetObjectives({
      labels: owned.row.objectivesMet,
      objectives: scenario.objectives,
    }),
  };

  const progress = await settleConversation({
    bossKind: owned.bossKind,
    feedback,
    objectives: scenario.objectives.length,
    objectivesMet,
    reviewRunId: runId,
    row: owned.row,
    spokenSeconds,
    timeZone,
    usedHelp,
    userId,
  });

  const won = hasPassedConversation({
    objectives: scenario.objectives.length,
    objectivesMet: objectivesMet.length,
  });

  if (!progress) {
    return { progress: null, status: "completed", won };
  }

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

  return { progress, status: "completed", won };
}
