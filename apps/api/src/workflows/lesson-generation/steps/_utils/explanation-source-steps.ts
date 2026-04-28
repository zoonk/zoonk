import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { type LessonKind, prisma } from "@zoonk/db";
import { type LessonContext } from "../get-lesson-step";

type ExplanationStep = {
  text: string;
  title: string;
};

export async function getOtherExplanationLessonTitles(context: LessonContext): Promise<string[]> {
  const lessons = await prisma.lesson.findMany({
    orderBy: { position: "asc" },
    where: {
      chapterId: context.chapterId,
      id: { not: context.id },
      kind: "explanation",
    },
  });

  return lessons.map((lesson) => lesson.title);
}

export async function getExplanationStepsSinceLastLessonKind({
  context,
  kind,
}: {
  context: LessonContext;
  kind: Extract<LessonKind, "practice" | "quiz">;
}): Promise<ExplanationStep[]> {
  const previousLesson = await prisma.lesson.findFirst({
    orderBy: { position: "desc" },
    where: {
      chapterId: context.chapterId,
      kind,
      position: { lt: context.position },
    },
  });

  return getExplanationStepsInRange({
    afterPosition: previousLesson?.position ?? -1,
    beforePosition: context.position,
    chapterId: context.chapterId,
  });
}

async function getExplanationStepsInRange({
  afterPosition,
  beforePosition,
  chapterId,
}: {
  afterPosition: number;
  beforePosition: number;
  chapterId: string;
}): Promise<ExplanationStep[]> {
  const lessons = await prisma.lesson.findMany({
    include: {
      steps: {
        orderBy: { position: "asc" },
        where: { kind: "static" },
      },
    },
    orderBy: { position: "asc" },
    where: {
      chapterId,
      generationStatus: "completed",
      kind: "explanation",
      position: { gt: afterPosition, lt: beforePosition },
    },
  });

  return lessons.flatMap((lesson) => lesson.steps.flatMap((step) => getTextStep(step.content)));
}

function getTextStep(content: unknown): ExplanationStep[] {
  const parsed = parseStepContent("static", content);

  if (parsed.variant !== "text") {
    return [];
  }

  return [{ text: parsed.text, title: parsed.title }];
}
