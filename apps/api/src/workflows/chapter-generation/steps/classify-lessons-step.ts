import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ChapterLesson } from "@zoonk/ai/tasks/chapters/lessons";
import { type LessonKindSchema, generateLessonKind } from "@zoonk/ai/tasks/lessons/kind";
import { type ChapterStepName } from "@zoonk/core/workflows/steps";
import { type ChapterLessonPlan } from "./generate-lessons-step";
import { type ChapterContext } from "./get-chapter-step";

type ClassifiedChapterLesson = ChapterLesson & { kind: LessonKindSchema["kind"] };

export type GeneratedChapterLesson =
  | ClassifiedChapterLesson
  | Extract<ChapterLessonPlan, { needsClassification: false }>["lessons"][number];

/**
 * The chapter planner and the lesson-kind classifier are separate durable
 * workflow steps so Workflow Inspect can show where time and failures happen.
 */
export async function classifyLessonsStep({
  context,
  plan,
}: {
  context: ChapterContext;
  plan: ChapterLessonPlan;
}): Promise<GeneratedChapterLesson[]> {
  "use step";

  await using stream = createStepStream<ChapterStepName>();

  await stream.status({ status: "started", step: "generateLessonKind" });

  if (!plan.needsClassification) {
    await stream.status({ status: "completed", step: "generateLessonKind" });
    return plan.lessons;
  }

  const lessons = await Promise.all(
    plan.lessons.map((lesson) => classifyChapterLesson({ context, lesson })),
  );

  await stream.status({ status: "completed", step: "generateLessonKind" });

  return lessons;
}

/**
 * Non-language lesson generation chooses content workflows from `LessonKind`,
 * so every planned lesson needs one kind before it can be saved.
 */
async function classifyChapterLesson({
  context,
  lesson,
}: {
  context: ChapterContext;
  lesson: ChapterLesson;
}): Promise<ClassifiedChapterLesson> {
  const result = await generateLessonKind({
    chapterTitle: context.title,
    courseTitle: context.course.title,
    language: context.language,
    lessonDescription: lesson.description,
    lessonTitle: lesson.title,
  });

  return {
    ...lesson,
    kind: result.data.kind,
  };
}
