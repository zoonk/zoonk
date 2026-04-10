import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { fetchLessonActivities } from "@/workflows/activity-generation/steps/_utils/fetch-lesson-activities";
import { generateActivityGrammarContent } from "@zoonk/ai/tasks/activities/language/grammar-content";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateGrammarContentStep } from "./generate-grammar-content-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({ releaseLock: vi.fn(), write: writeMock }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

vi.mock("@zoonk/ai/tasks/activities/language/grammar-content", () => ({
  generateActivityGrammarContent: vi.fn().mockResolvedValue({
    data: {
      examples: [{ highlight: "は", sentence: "これは猫です" }],
      exercises: [{ answer: "は", distractors: ["が", "を"], template: "これ[BLANK]猫です" }],
    },
  }),
}));

const validGrammarContent = {
  examples: [{ highlight: "は", sentence: "これは猫です" }],
  exercises: [{ answer: "は", distractors: ["が", "を"], template: "これ[BLANK]猫です" }],
};

describe(generateGrammarContentStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId, targetLanguage: "ja" });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Grammar Content Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns generated grammar content on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar Content ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    const [activity] = await fetchLessonActivities(lesson.id);
    const result = await generateGrammarContentStep(activity!, "workflow-1", ["particles"]);

    expect(result).toEqual({ generated: true, grammarContent: validGrammarContent });

    expect(generateActivityGrammarContent).toHaveBeenCalledWith(
      expect.objectContaining({
        chapterTitle: chapter.title,
        concepts: ["particles"],
        targetLanguage: "ja",
      }),
    );

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateGrammarContent" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateGrammarContent" }),
    );
  });

  test("marks activity as failed and streams error when AI fails", async () => {
    vi.mocked(generateActivityGrammarContent).mockRejectedValueOnce(new Error("AI error"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar Content Fail ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    const [activity] = await fetchLessonActivities(lesson.id);
    const result = await generateGrammarContentStep(activity!, "workflow-2");

    expect(result).toEqual({ generated: false, grammarContent: null });

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateGrammarContent" }),
    );
  });

  test("marks activity as failed and streams error when grammar content has no exercises", async () => {
    vi.mocked(generateActivityGrammarContent).mockResolvedValueOnce({
      data: { examples: [{ highlight: "は", sentence: "test" }], exercises: [] },
    } as never);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar Content Empty ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    const [activity] = await fetchLessonActivities(lesson.id);
    const result = await generateGrammarContentStep(activity!, "workflow-3");

    expect(result).toEqual({ generated: false, grammarContent: null });

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateGrammarContent" }),
    );
  });
});
