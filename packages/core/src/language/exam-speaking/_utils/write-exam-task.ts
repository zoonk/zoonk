import "server-only";
import { generateExamSpeakingCard } from "@zoonk/ai/tasks/v2/language/exam-speaking-card";
import { SPEAKING_EXAM_LANGUAGES } from "@zoonk/ai/tasks/v2/language/exam-speaking-exams";
import { type Goal } from "@zoonk/db";
import { createConversation } from "../../conversations/_utils/create-conversation";
import { type SpeakingCard } from "../speaking-contract";
import { type SpeakingFormat, type SpeakingTaskFormat } from "../speaking-format";
import { drawSpeakingPhotos } from "./speaking-photos";

export type WrittenExamTask = {
  card: SpeakingCard;
  conversationId: string;
  task: SpeakingTaskFormat;
};

/** The earlier task's card a task continues, as the card writer reads it. */
function toPreviousCard(previous: WrittenExamTask | null) {
  if (!previous) {
    return null;
  }

  const { instructions, prompts, table, text } = previous.card;
  return { instructions, prompts, table, task: previous.task.name, text };
}

/**
 * Writes one task of a speaking paper for the learner's goal and makes its call, ready to connect:
 * a card like the exam's own sheet (a model writes it now, with its photos drawn), the AI as the
 * task's examiner or partner, and the task's official time as the call's length. A task that
 * continues an earlier one (`previous`) stays on that card's topic.
 */
export async function writeExamTask({
  format,
  goal,
  previous = null,
  sectionId,
  task,
}: {
  format: SpeakingFormat;
  goal: Goal;
  previous?: WrittenExamTask | null;
  sectionId?: string;
  task: SpeakingTaskFormat;
}): Promise<WrittenExamTask> {
  const analytics = { contentScope: "personal", distinctId: goal.userId, goalId: goal.id } as const;

  const { data } = await generateExamSpeakingCard({
    analytics,
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

  const photos = await drawSpeakingPhotos({ analytics, photos: data.photos });

  const card: SpeakingCard = {
    instructions: data.instructions,
    photos,
    prompts: data.prompts,
    summary: data.summary,
    table: data.table,
    text: data.text,
  };

  const conversation = await createConversation({
    chapterId: null,
    goal,
    kind: "examSpeaking",
    language: goal.language,
    level: format.level,
    minutes: task.minutes.max,
    scenario: {
      character: data.character,
      characterBrief: data.characterBrief,
      examTask: { card, exam: format.exam, level: format.level, task: task.key },
      hints: data.hints,
      objectives: [{ description: data.summary, label: task.name }],
      openingLine: data.openingLine,
      situation: data.summary,
      title: task.name,
    },
    sectionId,
    targetLanguage: SPEAKING_EXAM_LANGUAGES[format.exam],
    userId: goal.userId,
  });

  return { card, conversationId: conversation.id, task };
}
