import { randomUUID } from "node:crypto";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { fetchLessonActivities } from "./_utils/fetch-lesson-activities";
import { getNeighboringConceptsStep } from "./get-neighboring-concepts-step";

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: vi.fn().mockResolvedValue(null),
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

describe(getNeighboringConceptsStep, () => {
  let organizationId: string;
  let chapterId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Neighboring Concepts Chapter ${randomUUID()}`,
    });
    chapterId = chapter.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns concepts from neighboring lessons within range", async () => {
    const id = randomUUID().slice(0, 8);

    /**
     * Create 5 lessons at positions 0-4, each with unique concepts.
     * The target lesson is at position 2. With NEIGHBOR_RANGE=3,
     * neighbors are positions [max(0, 2-3)..min(4, 2+3)] excluding 2,
     * so positions 0, 1, 3, 4.
     */
    const lessons = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        lessonFixture({
          chapterId,
          concepts: [`concept-${id}-pos${index}`],
          kind: "language",
          organizationId,
          position: index,
          title: `Neighbor Lesson ${index} ${randomUUID()}`,
        }),
      ),
    );

    const targetLesson = lessons.at(2);

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: targetLesson!.id,
      organizationId,
      position: 0,
      title: `Activity ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(targetLesson!.id);
    const result = await getNeighboringConceptsStep(activities);

    expect(result).toHaveLength(4);
    expect(result).toContain(`concept-${id}-pos0`);
    expect(result).toContain(`concept-${id}-pos1`);
    expect(result).toContain(`concept-${id}-pos3`);
    expect(result).toContain(`concept-${id}-pos4`);
    expect(result).not.toContain(`concept-${id}-pos2`);
  });

  test("returns empty array when activities list is empty", async () => {
    const result = await getNeighboringConceptsStep([]);
    expect(result).toEqual([]);
  });

  test("returns empty array when there are no neighboring lessons", async () => {
    /**
     * Create a single lesson with no neighbors in the chapter.
     * Use a fresh chapter to avoid interference from other tests.
     */
    const course = await courseFixture({ organizationId });
    const isolatedChapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Isolated Chapter ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: isolatedChapter.id,
      concepts: ["isolated-concept"],
      kind: "language",
      organizationId,
      position: 0,
      title: `Isolated Lesson ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      lessonId: lesson.id,
      organizationId,
      position: 0,
      title: `Isolated Activity ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const result = await getNeighboringConceptsStep(activities);

    expect(result).toEqual([]);
  });
});
