import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { addActivitiesStep } from "./add-activities-step";
import { type LessonContext } from "./get-lesson-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: writeMock,
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

describe(addActivitiesStep, () => {
  let organizationId: number;
  let context: LessonContext;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Add Activities Chapter ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Add Activities Lesson ${randomUUID()}`,
    });

    context = {
      ...lesson,
      _count: { activities: 0 },
      chapter: { ...chapter, course },
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates language activities in the database", async () => {
    const lesson = await lessonFixture({
      chapterId: context.chapter.id,
      kind: "language",
      organizationId,
      title: `Lang Activities ${randomUUID()}`,
    });

    const lessonContext: LessonContext = {
      ...lesson,
      _count: { activities: 0 },
      chapter: context.chapter,
    };

    await addActivitiesStep({
      concepts: [],
      context: lessonContext,
      customActivities: [],
      lessonKind: "language",
      targetLanguage: "es",
    });

    const activities = await prisma.activity.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id },
    });

    expect(activities.length).toBeGreaterThanOrEqual(5);
    expect(activities[0]!.kind).toBe("vocabulary");
    expect(activities[0]!.isPublished).toBe(true);
    expect(activities[0]!.language).toBe(lesson.language);
    expect(activities[0]!.organizationId).toBe(organizationId);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "addActivities" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "addActivities" }),
    );
  });

  test("creates core activities with explanation per concept", async () => {
    const lesson = await lessonFixture({
      chapterId: context.chapter.id,
      kind: "core",
      organizationId,
      title: `Core Activities ${randomUUID()}`,
    });

    const lessonContext: LessonContext = {
      ...lesson,
      _count: { activities: 0 },
      chapter: context.chapter,
    };

    await addActivitiesStep({
      concepts: ["Concept A", "Concept B"],
      context: lessonContext,
      customActivities: [],
      lessonKind: "core",
      targetLanguage: null,
    });

    const activities = await prisma.activity.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id },
    });

    const explanations = activities.filter((a) => a.kind === "explanation");

    expect(explanations).toHaveLength(2);
    expect(explanations[0]!.title).toBe("Concept A");
    expect(explanations[1]!.title).toBe("Concept B");
  });

  test("streams error and throws when DB save fails", async () => {
    const brokenContext: LessonContext = {
      ...context,
      id: 999_999_999,
    };

    await expect(
      addActivitiesStep({
        concepts: [],
        context: brokenContext,
        customActivities: [],
        lessonKind: "language",
        targetLanguage: "es",
      }),
    ).rejects.toThrow();

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "addActivities" }),
    );
  });

  test("marks review activities as completed", async () => {
    const lesson = await lessonFixture({
      chapterId: context.chapter.id,
      kind: "language",
      organizationId,
      title: `Review Status ${randomUUID()}`,
    });

    const lessonContext: LessonContext = {
      ...lesson,
      _count: { activities: 0 },
      chapter: context.chapter,
    };

    await addActivitiesStep({
      concepts: [],
      context: lessonContext,
      customActivities: [],
      lessonKind: "language",
      targetLanguage: "es",
    });

    const activities = await prisma.activity.findMany({
      where: { lessonId: lesson.id },
    });

    const reviewActivities = activities.filter((a) => a.kind === "review");
    const nonReviewActivities = activities.filter((a) => a.kind !== "review");

    expect(reviewActivities.every((a) => a.generationStatus === "completed")).toBe(true);
    expect(nonReviewActivities.every((a) => a.generationStatus === "pending")).toBe(true);
  });
});
