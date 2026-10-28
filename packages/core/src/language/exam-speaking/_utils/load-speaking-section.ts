import "server-only";
import { SPEAKING_EXAM_LANGUAGES } from "@zoonk/ai/tasks/v2/language/exam-speaking-exams";
import { type LanguageConversation, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import {
  type ExamTaskSnapshot,
  type SpeakingSectionView,
  examSpeakingFeedbackSchema,
  examTaskSnapshotSchema,
} from "../speaking-contract";
import { type SpeakingTaskGrade, estimateSpeakingSection } from "../speaking-estimate";
import { getSpeakingFormat } from "../speaking-formats";
import { toSpeakingTaskView } from "../speaking-views";

type SectionRow = Pick<
  LanguageConversation,
  "feedback" | "id" | "scenario" | "spokenSeconds" | "status"
>;

function readSnapshot(row: SectionRow): ExamTaskSnapshot | null {
  const parsed = isJsonObject(row.scenario)
    ? examTaskSnapshotSchema.safeParse(row.scenario.examTask)
    : null;

  return parsed?.success ? parsed.data : null;
}

function toGrade({ row, task }: { row: SectionRow; task: string }): SpeakingTaskGrade[] {
  const feedback = examSpeakingFeedbackSchema.safeParse(row.feedback);

  return feedback.success
    ? [{ criteria: feedback.data.criteria, spokenSeconds: row.spokenSeconds, task }]
    : [];
}

function isTyped(row: SectionRow): boolean {
  const feedback = examSpeakingFeedbackSchema.safeParse(row.feedback);
  return feedback.success && !feedback.data.heard;
}

export async function loadSpeakingSection({
  sectionId,
  userId,
}: {
  sectionId: string;
  userId: string;
}): Promise<SpeakingSectionView | null> {
  const rows = await prisma.languageConversation.findMany({
    select: { feedback: true, id: true, scenario: true, spokenSeconds: true, status: true },
    where: { kind: "examSpeaking", sectionId, userId },
  });

  const tasked = rows.flatMap((row) => {
    const snapshot = readSnapshot(row);
    return snapshot ? [{ row, snapshot }] : [];
  });

  const format = tasked[0] ? getSpeakingFormat(tasked[0].snapshot) : null;

  if (!format) {
    return null;
  }

  const byTask = new Map(tasked.map(({ row, snapshot }) => [snapshot.task, row]));

  const tasks = format.tasks.flatMap((task) => {
    const row = byTask.get(task.key);

    if (!row) {
      return [];
    }

    return [
      { ...toSpeakingTaskView({ format, task }), conversationId: row.id, status: row.status },
    ];
  });

  const grades = tasked.flatMap(({ row, snapshot }) => toGrade({ row, task: snapshot.task }));
  const { complete, high, low, total } = estimateSpeakingSection({ format, grades });

  return {
    estimate: { complete, high, low, total, typed: tasked.some(({ row }) => isTyped(row)) },
    exam: format.exam,
    id: sectionId,
    language: SPEAKING_EXAM_LANGUAGES[format.exam],
    level: format.level,
    paper: format.paper,
    pass: format.pass,
    prepMinutes: format.prepMinutes,
    prepTasks: [...format.prepTasks],
    source: format.source,
    tasks,
    title: format.title,
  };
}
