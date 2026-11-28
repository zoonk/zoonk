import "server-only";
import { prisma } from "@zoonk/db";
import { isSandboxLanguage } from "../../library/activities/programs/program-languages";
import { type LessonStepAnswer, lessonStepAnswerSchema } from "../contract";
import { type PlayableLibraryStep } from "../playable-lesson";

export async function resolveMeasuredOutput({
  answer,
  savedAnswer,
  step,
  userId,
}: {
  answer: LessonStepAnswer;
  savedAnswer?: unknown;
  step: PlayableLibraryStep;
  userId: string;
}): Promise<LessonStepAnswer | null> {
  if (step.kind !== "activity" || step.content.template !== "codeRunner") {
    return answer;
  }

  const { language } = step.content.fields;

  if (!isSandboxLanguage(language)) {
    return answer;
  }

  const saved = lessonStepAnswerSchema.safeParse(savedAnswer);

  if (saved.success) {
    return saved.data;
  }

  if (answer.kind !== "activity" || answer.answer.kind !== "output" || !answer.answer.runId) {
    return null;
  }

  const run = await prisma.codeRun.findFirst({
    where: { finishedAt: { not: null }, id: answer.answer.runId, language, userId },
  });

  if (run?.output === null || !run?.stop || run.stop === "unavailable") {
    return null;
  }

  return { ...answer, answer: { ...answer.answer, output: run.output } };
}
