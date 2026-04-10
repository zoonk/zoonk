import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { fetchLessonActivities } from "@/workflows/activity-generation/steps/_utils/fetch-lesson-activities";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateExplanationContentStep } from "./generate-explanation-content-step";

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

const { generateActivityExplanationMock } = vi.hoisted(() => ({
  generateActivityExplanationMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/core/explanation", () => ({
  generateActivityExplanation: generateActivityExplanationMock,
}));

describe(generateExplanationContentStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Explanation Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns explanation results for each activity", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Explanation Content ${randomUUID()}`,
    });

    await Promise.all([
      activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        title: `Concept A ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: `Concept B ${randomUUID()}`,
      }),
    ]);

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityExplanationMock.mockResolvedValue({
      data: {
        steps: [
          { text: "Step text", title: "Step title" },
          { text: "Step text 2", title: "Step title 2" },
        ],
      },
    });

    const concepts = activities.map((a) => a.title ?? "");
    const neighboringConcepts = ["neighbor1"];

    const result = await generateExplanationContentStep(activities, concepts, neighboringConcepts);

    expect(result.results).toHaveLength(2);
    expect(result.results[0]?.activityId).toBe(activities[0]?.id);
    expect(result.results[0]?.steps).toEqual([
      { text: "Step text", title: "Step title" },
      { text: "Step text 2", title: "Step title 2" },
    ]);
    expect(result.results[1]?.activityId).toBe(activities[1]?.id);
  });

  test("returns empty results when activities list is empty", async () => {
    const result = await generateExplanationContentStep([], ["concept"], ["neighbor"]);
    expect(result).toEqual({ results: [] });
  });

  test("streams started and completed events", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Explanation Stream ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Stream Concept ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityExplanationMock.mockResolvedValue({
      data: { steps: [{ text: "text", title: "title" }] },
    });

    await generateExplanationContentStep(activities, ["concept"], []);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateExplanationContent" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateExplanationContent" }),
    );
  });

  test("streams error status when some AI calls fail", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Explanation Error ${randomUUID()}`,
    });

    await Promise.all([
      activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        title: `Good Concept ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: `Bad Concept ${randomUUID()}`,
      }),
    ]);

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityExplanationMock
      .mockResolvedValueOnce({
        data: { steps: [{ text: "ok", title: "ok" }] },
      })
      .mockRejectedValueOnce(new Error("AI failure"));

    const concepts = activities.map((a) => a.title ?? "");

    const result = await generateExplanationContentStep(activities, concepts, []);

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.activityId).toBe(activities[0]?.id);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateExplanationContent" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateExplanationContent" }),
    );
  });
});
