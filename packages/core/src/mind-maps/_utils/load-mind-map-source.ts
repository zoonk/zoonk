import "server-only";
import { type MindMapChapter, type MindMapLesson } from "@zoonk/ai/tasks/v2/mind-maps/structure";
import { type Step, prisma } from "@zoonk/db";
import { toSummaryIdeas } from "../../library/lessons/_utils/summary-ideas";
import { CURRENT_STEPS } from "../../library/lessons/lesson-versions";
import { safeParseStepContent } from "../../library/steps/contract/step-contract";

type TeachingStep = Pick<Step, "content" | "kind">;

/** A screen that teaches (an explanation or a worked example) as the map reads it. */
function toScreen(step: TeachingStep): MindMapLesson["screens"] {
  if (step.kind === "explanation") {
    const parsed = safeParseStepContent("explanation", step.content);
    return parsed.success ? [{ text: parsed.data.text, title: parsed.data.title ?? null }] : [];
  }

  const parsed = safeParseStepContent("workedExample", step.content);

  if (!parsed.success) {
    return [];
  }

  const { problem, result, steps, title } = parsed.data;
  const text = [problem, ...steps.map((item) => item.text), result].join(" ");

  return [{ text, title: title ?? null }];
}

/**
 * What a chapter's map is written from: its title, description and objectives, and each written
 * lesson in order with what the learner can do after it, its summary card and the screens that
 * teach (questions left out). Null for a chapter without written lessons.
 */
export async function loadMindMapSource(chapterId: string): Promise<MindMapChapter | null> {
  const chapter = await prisma.chapter.findUnique({
    select: {
      description: true,
      language: true,
      lessons: {
        orderBy: { position: "asc" },
        select: {
          lesson: {
            select: {
              canDo: true,
              steps: {
                orderBy: { position: "asc" },
                select: { content: true, kind: true },
                where: { kind: { in: ["explanation", "workedExample"] }, ...CURRENT_STEPS },
              },
              summary: true,
              title: true,
            },
          },
        },
        where: { lesson: { contentStatus: "completed" } },
      },
      objectives: true,
      title: true,
    },
    where: { id: chapterId },
  });

  if (!chapter || chapter.lessons.length === 0) {
    return null;
  }

  return {
    description: chapter.description,
    language: chapter.language,
    lessons: chapter.lessons.map(({ lesson }) => ({
      canDo: lesson.canDo,
      screens: lesson.steps.flatMap((step) => toScreen(step)),
      summary: toSummaryIdeas(lesson.summary),
      title: lesson.title,
    })),
    objectives: chapter.objectives,
    title: chapter.title,
  };
}
