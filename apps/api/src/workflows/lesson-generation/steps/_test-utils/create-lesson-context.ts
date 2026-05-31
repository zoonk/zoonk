import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { type LessonContext } from "../get-lesson-step";

/**
 * Generation steps receive a lesson loaded with chapter, course, organization,
 * and step count relations. This test helper creates that real database shape
 * so each individual step test can focus on the behavior of one step module.
 */
export async function createLessonContext({
  generationStatus = "pending",
  kind = "explanation",
  organizationId,
  position = 1,
  targetLanguage = null,
  titlePrefix = "Lesson Generation",
}: {
  generationStatus?: LessonContext["generationStatus"];
  kind?: LessonContext["kind"];
  organizationId: string;
  position?: number;
  targetLanguage?: string | null;
  titlePrefix?: string;
}): Promise<LessonContext> {
  const course = await courseFixture({
    isPublished: true,
    organizationId,
    targetLanguage,
    title: `${titlePrefix} Course ${randomUUID()}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId,
    title: `${titlePrefix} Chapter ${randomUUID()}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    generationStatus,
    isPublished: true,
    kind,
    organizationId,
    position,
    title: `${titlePrefix} Lesson ${randomUUID()}`,
  });

  return prisma.lesson.findUniqueOrThrow({
    include: {
      _count: { select: { steps: true } },
      chapter: { include: { course: { include: { organization: true } } } },
    },
    where: { id: lesson.id },
  });
}

/**
 * Practice and quiz generation use explanation title and description metadata
 * since the previous practice or quiz lesson. This helper still creates a
 * completed source lesson with one step for tests that need saved content too.
 */
export async function createCompletedExplanation({
  chapterId,
  organizationId,
  position,
  text,
  title,
}: {
  chapterId: string;
  organizationId: string;
  position: number;
  text: string;
  title: string;
}) {
  const lesson = await lessonFixture({
    chapterId,
    description: text,
    generationStatus: "completed",
    isPublished: true,
    kind: "explanation",
    organizationId,
    position,
    title,
  });

  await stepFixture({
    content: { text, title, variant: "text" },
    isPublished: true,
    kind: "static",
    lessonId: lesson.id,
    position: 0,
  });

  return lesson;
}
