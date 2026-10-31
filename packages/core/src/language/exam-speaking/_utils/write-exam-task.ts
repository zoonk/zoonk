import "server-only";
import { generateExamSpeakingCard } from "@zoonk/ai/tasks/language/exam-speaking-card";
import { SPEAKING_EXAM_LANGUAGES } from "@zoonk/ai/tasks/language/exam-speaking-exams";
import { type Goal } from "@zoonk/db";
import { toConversationData } from "../../conversations/_utils/create-conversation";
import { type SpeakingCard } from "../speaking-contract";
import { type SpeakingFormat, type SpeakingTaskFormat } from "../speaking-format";

export type ExamCardDraft = Awaited<ReturnType<typeof generateExamSpeakingCard>>["data"];

export type WrittenExamCard = { draft: ExamCardDraft; photos: SpeakingCard["photos"] };

type PreviousCard = { draft: ExamCardDraft; task: SpeakingTaskFormat };

function toPreviousCard(previous: PreviousCard | null) {
  if (!previous) {
    return null;
  }

  const { instructions, prompts, table, text } = previous.draft;
  return { instructions, prompts, table, task: previous.task.name, text };
}

export async function writeExamCard({
  format,
  goal,
  previous,
  task,
}: {
  format: SpeakingFormat;
  goal: Pick<Goal, "id" | "language" | "userId">;
  previous: PreviousCard | null;
  task: SpeakingTaskFormat;
}): Promise<ExamCardDraft> {
  const { data } = await generateExamSpeakingCard({
    analytics: { contentScope: "personal", distinctId: goal.userId, goalId: goal.id },
    exam: format.exam,
    learnerLanguage: goal.language,
    level: format.level,
    paper: format.paper,
    previous: toPreviousCard(previous),
    task: {
      brief: task.brief,
      minutes: task.minutes.max,
      name: task.name,
      role: task.role,
      stimulus: task.stimulus,
    },
    title: format.title,
  });

  return data;
}

export function toExamTaskConversation({
  format,
  goal,
  sectionId,
  task,
  written,
}: {
  format: SpeakingFormat;
  goal: Goal;
  sectionId?: string;
  task: SpeakingTaskFormat;
  written: WrittenExamCard;
}) {
  const { draft, photos } = written;

  const card: SpeakingCard = {
    instructions: draft.instructions,
    photos,
    prompts: draft.prompts,
    summary: draft.summary,
    table: draft.table,
    text: draft.text,
  };

  return toConversationData({
    chapterId: null,
    goal,
    kind: "examSpeaking",
    language: goal.language,
    level: format.level,
    minutes: task.minutes.max,
    scenario: {
      character: draft.character,
      characterBrief: draft.characterBrief,
      examTask: { card, exam: format.exam, level: format.level, task: task.key },
      hints: draft.hints,
      objectives: [{ description: draft.summary, label: task.name }],
      openingLine: draft.openingLine,
      situation: draft.summary,
      title: task.name,
    },
    sectionId,
    targetLanguage: SPEAKING_EXAM_LANGUAGES[format.exam],
    userId: goal.userId,
  });
}
