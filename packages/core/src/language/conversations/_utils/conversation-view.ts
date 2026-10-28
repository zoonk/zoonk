import "server-only";
import { buildLiveConversationInstructions } from "@zoonk/ai/tasks/v2/language/live-conversation-instructions";
import { type Chapter, type LanguageConversation } from "@zoonk/db";
import { isCefrLevel } from "@zoonk/utils/cefr";
import { type ExamTaskSnapshot } from "../../exam-speaking/speaking-contract";
import { getSpeakingFormat, getSpeakingTask } from "../../exam-speaking/speaking-formats";
import { toExamTaskView } from "../../exam-speaking/speaking-views";
import {
  type ConversationScenario,
  type LanguageConversationView,
  type SpeakingMockExam,
  conversationFeedbackSchema,
  conversationScenarioSchema,
  examSpeakingScenarioSchema,
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

export type SavedScenario = ConversationScenario & {
  exam: SpeakingMockExam | null;
  examTask: ExamTaskSnapshot | null;
};

export function readSavedScenario(
  row: Pick<LanguageConversation, "kind" | "scenario">,
): SavedScenario | null {
  if (row.kind === "speakingMock") {
    const mock = speakingMockScenarioSchema.safeParse(row.scenario);
    return mock.success ? { ...mock.data, examTask: null } : null;
  }

  if (row.kind === "examSpeaking") {
    const task = examSpeakingScenarioSchema.safeParse(row.scenario);
    return task.success ? { ...task.data, exam: null } : null;
  }

  const scenario = conversationScenarioSchema.safeParse(row.scenario);
  return scenario.success ? { ...scenario.data, exam: null, examTask: null } : null;
}

function toLiveRole(data: SavedScenario) {
  if (data.examTask) {
    const format = getSpeakingFormat(data.examTask);
    const task = format ? getSpeakingTask({ format, task: data.examTask.task }) : null;

    return format && task
      ? {
          examTask: {
            card: data.examTask.card,
            exam: format.exam,
            task: { brief: task.brief, name: task.name, role: task.role },
            title: format.title,
          },
          kind: "examTask" as const,
        }
      : null;
  }

  return data.exam ? { exam: data.exam, kind: "speakingMock" as const } : { kind: "unit" as const };
}

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

export function buildConversationInstructions(row: ConversationRow): string | null {
  const data = readSavedScenario(row);
  const role = data ? toLiveRole(data) : null;

  if (!data || !role || !isCefrLevel(row.level) || row.status !== "ready") {
    return null;
  }

  return buildLiveConversationInstructions({
    ...role,
    learnerLanguage: row.language,
    level: row.level,
    minutes: row.minutes,
    scenario: data,
    targetLanguage: row.targetLanguage,
  });
}

export function toConversationView({
  bossKind = "boss",
  row,
}: {
  bossKind?: "boss" | "finalBoss";
  row: ConversationRow;
}): LanguageConversationView | null {
  const data = readSavedScenario(row);
  const role = data ? toLiveRole(data) : null;

  if (!data || !role || !isCefrLevel(row.level)) {
    return null;
  }

  const met = new Set(row.objectivesMet);

  return {
    character: data.character,
    exam: data.exam,
    examTask: data.examTask
      ? toExamTaskView({ sectionId: row.sectionId, snapshot: data.examTask })
      : null,
    goalId: row.goalId,
    hints: data.hints,
    id: row.id,
    kind: row.kind,
    level: row.level,
    locked: false,
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
