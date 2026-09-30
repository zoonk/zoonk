import "server-only";
import { buildLiveConversationInstructions } from "@zoonk/ai/tasks/v2/language/live-conversation-instructions";
import { type Chapter, type LanguageConversation } from "@zoonk/db";
import { isCefrLevel } from "@zoonk/utils/cefr";
import {
  type ConversationScenario,
  type LanguageConversationView,
  type SpeakingMockExam,
  conversationFeedbackSchema,
  conversationScenarioSchema,
  speakingMockScenarioSchema,
} from "../conversation-contract";
import {
  getConversationBrainPower,
  getConversationStars,
  hasPassedConversation,
} from "../conversation-rules";

export type ConversationRow = LanguageConversation & {
  chapter: Pick<Chapter, "id" | "title"> | null;
};

export type SavedScenario = ConversationScenario & { exam: SpeakingMockExam | null };

/**
 * The scenario saved with a call. A speaking mock's also names the exam it follows, which only
 * mocks have. Null when it doesn't parse.
 */
export function readSavedScenario(
  row: Pick<LanguageConversation, "kind" | "scenario">,
): SavedScenario | null {
  if (row.kind === "speakingMock") {
    const mock = speakingMockScenarioSchema.safeParse(row.scenario);
    return mock.success ? mock.data : null;
  }

  const scenario = conversationScenarioSchema.safeParse(row.scenario);
  return scenario.success ? { ...scenario.data, exam: null } : null;
}

/** A checkpoint call pays the boss bonus; the block's own kind tells a final boss apart. */
export function getCheckpointOutcome({
  bossKind,
  row,
}: {
  bossKind: "boss" | "finalBoss";
  row: Pick<LanguageConversation, "kind" | "objectivesMet"> & { objectives: number };
}) {
  if (row.kind !== "checkpoint") {
    return null;
  }

  return {
    kind: bossKind,
    passed: hasPassedConversation({
      objectives: row.objectives,
      objectivesMet: row.objectivesMet.length,
    }),
  };
}

function toResult({
  bossKind,
  objectives,
  row,
}: {
  bossKind: "boss" | "finalBoss";
  objectives: number;
  row: ConversationRow;
}): LanguageConversationView["result"] {
  if (row.status !== "completed") {
    return null;
  }

  const checkpoint = getCheckpointOutcome({ bossKind, row: { ...row, objectives } });
  const feedback = conversationFeedbackSchema.safeParse(row.feedback);

  return {
    brainPower: getConversationBrainPower({ checkpoint, objectivesMet: row.objectivesMet.length }),
    feedback: feedback.success ? feedback.data : null,
    passed: hasPassedConversation({ objectives, objectivesMet: row.objectivesMet.length }),
    spokenSeconds: row.spokenSeconds,
    stars: getConversationStars({
      objectives,
      objectivesMet: row.objectivesMet.length,
      usedHelp: row.usedHelp,
    }),
  };
}

/**
 * What a call screen shows, the same for Focus and Fun: the character, the goals of the call with
 * the ones met, hints, and once it ends, the result with the feedback. The voice model's
 * instructions are included only while the call can still be made.
 */
export function toConversationView({
  bossKind = "boss",
  row,
}: {
  bossKind?: "boss" | "finalBoss";
  row: ConversationRow;
}): LanguageConversationView | null {
  const data = readSavedScenario(row);

  if (!data || !isCefrLevel(row.level)) {
    return null;
  }

  const met = new Set(row.objectivesMet);

  const instructions =
    row.status === "ready"
      ? buildLiveConversationInstructions({
          ...(data.exam ? { exam: data.exam, kind: "speakingMock" } : { kind: "unit" }),
          learnerLanguage: row.language,
          level: row.level,
          minutes: row.minutes,
          scenario: data,
          targetLanguage: row.targetLanguage,
        })
      : null;

  return {
    character: data.character,
    exam: data.exam,
    goalId: row.goalId,
    hints: data.hints,
    id: row.id,
    instructions,
    kind: row.kind,
    level: row.level,
    minutes: row.minutes,
    objectives: data.objectives.map((objective) => ({
      ...objective,
      met: met.has(objective.label),
    })),
    openingLine: data.openingLine,
    result: toResult({ bossKind, objectives: data.objectives.length, row }),
    situation: data.situation,
    status: row.status,
    targetLanguage: row.targetLanguage,
    title: data.title,
    unit: row.chapter ? { chapterId: row.chapter.id, title: row.chapter.title } : null,
  };
}
