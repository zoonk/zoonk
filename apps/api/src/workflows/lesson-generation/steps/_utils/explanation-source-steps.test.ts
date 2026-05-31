import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import { type LessonContext } from "../get-lesson-step";
import {
  getOtherExplanationLessonTitles,
  getSourceLessonsSinceLastLessonKind,
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
 * Explanation source metadata comes from planned lesson rows, so generation
 * status should not decide whether practice and quiz can receive that scope.
 */
async function createSourceExplanation({
  chapterId,
  generationStatus = "completed",
  organizationId,
  position,
  text,
  title,
}: {
  chapterId: string;
  generationStatus?: "completed" | "pending";
  organizationId: string;
  position: number;
  text: string;
  title: string;
}) {
  const lesson = await lessonFixture({
    chapterId,
    description: text,
    generationStatus,
    isPublished: true,
    kind: "explanation",
    organizationId,
    position,
    title,
  });

  return lesson;
}

describe("explanation source lesson helpers", () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("returns other explanation lesson titles in chapter order", async () => {
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

    await expect(getOtherExplanationLessonTitles(context)).resolves.toStrictEqual([
      "First explanation",
      "Second explanation",
    ]);
  });

  it("returns source lesson metadata since the previous practice", async () => {
    const context = await createContext({ kind: "practice", organizationId, position: 4 });

    await Promise.all([
      createSourceExplanation({
        chapterId: context.chapterId,
        organizationId,
        position: 0,
        text: "Old explanation",
        title: "Old",
      }),
      lessonFixture({
        chapterId: context.chapterId,
        generationStatus: "completed",
        isPublished: true,
        kind: "practice",
        organizationId,
        position: 1,
      }),
      createSourceExplanation({
        chapterId: context.chapterId,
        generationStatus: "pending",
        organizationId,
        position: 2,
        text: "New explanation",
        title: "New",
      }),
      lessonFixture({
        chapterId: context.chapterId,
        generationStatus: "pending",
        isPublished: true,
        kind: "explanation",
        organizationId,
        position: 3,
        title: "Pending explanation",
      }),
    ]);

    const sourceLessons = await getSourceLessonsSinceLastLessonKind({ context, kind: "practice" });

    expect(sourceLessons).toStrictEqual([
      { description: "New explanation", title: "New" },
      { description: "Test lesson description", title: "Pending explanation" },
    ]);
  });

  it("returns source lesson metadata since the previous quiz", async () => {
    const context = await createContext({ kind: "quiz", organizationId, position: 5 });

    await Promise.all([
      createSourceExplanation({
        chapterId: context.chapterId,
        organizationId,
        position: 0,
        text: "Already quizzed",
        title: "Old",
      }),
      lessonFixture({
        chapterId: context.chapterId,
        generationStatus: "completed",
        isPublished: true,
        kind: "quiz",
        organizationId,
        position: 1,
      }),
      createSourceExplanation({
        chapterId: context.chapterId,
        generationStatus: "pending",
        organizationId,
        position: 2,
        text: "New quiz source",
        title: "New",
      }),
    ]);

    const sourceLessons = await getSourceLessonsSinceLastLessonKind({ context, kind: "quiz" });

    expect(sourceLessons).toStrictEqual([{ description: "New quiz source", title: "New" }]);
  });
});
