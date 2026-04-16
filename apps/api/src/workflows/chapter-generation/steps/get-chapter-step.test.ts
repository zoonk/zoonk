import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { getChapterStep } from "./get-chapter-step";

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

describe(getChapterStep, () => {
  let organizationId: string;
  let courseId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    courseId = course.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns chapter with course and lesson count", async () => {
    const chapter = await chapterFixture({
      courseId,
      organizationId,
      position: 0,
      title: `Get Chapter ${randomUUID()}`,
    });

    const result = await getChapterStep(chapter.id);

    expect(result.id).toBe(chapter.id);
    expect(result.course.id).toBe(courseId);
    expect(result._count.lessons).toBe(0);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "getChapter" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "getChapter" }),
    );
  });

  test("includes neighboring chapters within range", async () => {
    // Use a dedicated course so other tests' chapters don't interfere with neighbor counts
    const isolatedCourse = await courseFixture({ organizationId });

    const chapters = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        chapterFixture({
          courseId: isolatedCourse.id,
          organizationId,
          position: i,
          title: `Neighbor ${i} ${randomUUID()}`,
        }),
      ),
    );

    const middleChapter = chapters[2]!;

    const result = await getChapterStep(middleChapter.id);

    const neighborTitles = result.neighboringChapters.map((ch) => ch.title);
    const expectedNeighborTitles = chapters
      .filter((ch) => ch.id !== middleChapter.id)
      .map((ch) => ch.title);

    expect(neighborTitles).toHaveLength(4);
    expect(neighborTitles).toEqual(expect.arrayContaining(expectedNeighborTitles));
    expect(neighborTitles).not.toContain(middleChapter.title);
  });

  test("excludes archived neighboring chapters", async () => {
    const isolatedCourse = await courseFixture({ organizationId });

    const chapters = await Promise.all([
      chapterFixture({
        courseId: isolatedCourse.id,
        organizationId,
        position: 0,
        title: `Neighbor A ${randomUUID()}`,
      }),
      chapterFixture({
        archivedAt: new Date(),
        courseId: isolatedCourse.id,
        organizationId,
        position: 1,
        title: `Archived Neighbor ${randomUUID()}`,
      }),
      chapterFixture({
        courseId: isolatedCourse.id,
        organizationId,
        position: 2,
        title: `Target ${randomUUID()}`,
      }),
      chapterFixture({
        courseId: isolatedCourse.id,
        organizationId,
        position: 3,
        title: `Neighbor B ${randomUUID()}`,
      }),
    ]);

    const targetChapter = chapters[2];

    const result = await getChapterStep(targetChapter.id);

    const neighborTitles = result.neighboringChapters.map((chapter) => chapter.title);

    expect(neighborTitles).toHaveLength(2);
    expect(neighborTitles).toContain(chapters[0].title);
    expect(neighborTitles).toContain(chapters[3].title);
    expect(neighborTitles).not.toContain(chapters[1].title);
  });

  test("throws FatalError when chapter does not exist", async () => {
    await expect(getChapterStep(999_999_999)).rejects.toThrow("Chapter not found");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(expect.objectContaining({ status: "error", step: "getChapter" }));
  });

  test("throws FatalError when chapter is archived", async () => {
    const chapter = await chapterFixture({
      archivedAt: new Date(),
      courseId,
      organizationId,
      position: 0,
      title: `Archived Chapter ${randomUUID()}`,
    });

    await expect(getChapterStep(chapter.id)).rejects.toThrow("Chapter not found");
  });

  test("throws FatalError when chapter is outside the AI organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const chapter = await chapterFixture({
      courseId: otherCourse.id,
      organizationId: otherOrg.id,
      position: 0,
      title: `Manual Chapter ${randomUUID()}`,
    });

    await expect(getChapterStep(chapter.id)).rejects.toThrow("Chapter not found");
  });
});
