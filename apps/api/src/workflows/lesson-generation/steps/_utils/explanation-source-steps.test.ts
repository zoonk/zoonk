import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, describe, expect, test } from "vitest";
import { type LessonContext } from "../get-lesson-step";
import {
  getExplanationStepsSinceLastLessonKind,
  getOtherExplanationLessonTitles,
} from "./explanation-source-steps";

/**
 * Explanation-source helpers query around a current practice or quiz lesson.
 * This builds the same lesson context shape so tests exercise the real DB
 * ordering and range rules instead of a hand-written array.
 */
async function createContext({
  kind = "practice",
  organizationId,
  position = 4,
}: {
  kind?: Extract<LessonContext["kind"], "practice" | "quiz">;
  organizationId: string;
  position?: number;
}): Promise<LessonContext> {
  const course = await courseFixture({
    isPublished: true,
    organizationId,
    title: `Explanation Source Course ${randomUUID()}`,
  });
  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId,
    title: `Explanation Source Chapter ${randomUUID()}`,
  });
  const lesson = await lessonFixture({
    chapterId: chapter.id,
    generationStatus: "pending",
    isPublished: true,
    kind,
    organizationId,
    position,
    title: `Explanation Source Lesson ${randomUUID()}`,
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
 * Completed explanation lessons are the only source content practice and quiz
 * lessons should see, and only text-variant static steps carry explanation text.
 */
async function createCompletedExplanation({
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
    generationStatus: "completed",
    isPublished: true,
    kind: "explanation",
    organizationId,
    position,
    title,
  });

  await Promise.all([
    stepFixture({
      content: { text, title, variant: "text" },
      isPublished: true,
      kind: "static",
      lessonId: lesson.id,
      position: 0,
    }),
    stepFixture({
      content: {
        ruleName: "Ignored rule",
        ruleSummary: "Not explanation text",
        variant: "grammarRule",
      },
      isPublished: true,
      kind: "static",
      lessonId: lesson.id,
      position: 1,
    }),
  ]);

  return lesson;
}

describe("explanation source step helpers", () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  test("returns other explanation lesson titles in chapter order", async () => {
    const context = await createContext({ organizationId, position: 2 });

    await Promise.all([
      lessonFixture({
        chapterId: context.chapterId,
        isPublished: true,
        kind: "explanation",
        organizationId,
        position: 0,
        title: "First explanation",
      }),
      lessonFixture({
        chapterId: context.chapterId,
        isPublished: true,
        kind: "explanation",
        organizationId,
        position: 1,
        title: "Second explanation",
      }),
    ]);

    await expect(getOtherExplanationLessonTitles(context)).resolves.toEqual([
      "First explanation",
      "Second explanation",
    ]);
  });

  test("returns only completed explanation text since the previous practice", async () => {
    const context = await createContext({ kind: "practice", organizationId, position: 4 });

    await createCompletedExplanation({
      chapterId: context.chapterId,
      organizationId,
      position: 0,
      text: "Old explanation",
      title: "Old",
    });
    await lessonFixture({
      chapterId: context.chapterId,
      generationStatus: "completed",
      isPublished: true,
      kind: "practice",
      organizationId,
      position: 1,
    });
    await createCompletedExplanation({
      chapterId: context.chapterId,
      organizationId,
      position: 2,
      text: "New explanation",
      title: "New",
    });
    await lessonFixture({
      chapterId: context.chapterId,
      generationStatus: "pending",
      isPublished: true,
      kind: "explanation",
      organizationId,
      position: 3,
      title: "Pending explanation",
    });

    const steps = await getExplanationStepsSinceLastLessonKind({ context, kind: "practice" });

    expect(steps).toEqual([{ text: "New explanation", title: "New" }]);
  });

  test("uses the previous quiz boundary for quiz source content", async () => {
    const context = await createContext({ kind: "quiz", organizationId, position: 5 });

    await createCompletedExplanation({
      chapterId: context.chapterId,
      organizationId,
      position: 0,
      text: "Already quizzed",
      title: "Old",
    });
    await lessonFixture({
      chapterId: context.chapterId,
      generationStatus: "completed",
      isPublished: true,
      kind: "quiz",
      organizationId,
      position: 1,
    });
    await createCompletedExplanation({
      chapterId: context.chapterId,
      organizationId,
      position: 2,
      text: "New quiz source",
      title: "New",
    });

    const steps = await getExplanationStepsSinceLastLessonKind({ context, kind: "quiz" });

    expect(steps).toEqual([{ text: "New quiz source", title: "New" }]);
  });
});
