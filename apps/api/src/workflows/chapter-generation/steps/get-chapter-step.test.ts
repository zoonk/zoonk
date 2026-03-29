import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
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
  let organizationId: number;
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
    const chapters = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        chapterFixture({
          courseId,
          organizationId,
          position: i,
          title: `Neighbor ${i} ${randomUUID()}`,
        }),
      ),
    );

    const middleChapter = chapters[2]!;

    const result = await getChapterStep(middleChapter.id);

    expect(result.neighboringChapters.length).toBeGreaterThan(0);

    const neighborTitles = result.neighboringChapters.map((ch) => ch.title);

    expect(neighborTitles).not.toContain(middleChapter.title);
  });

  test("throws FatalError when chapter does not exist", async () => {
    await expect(getChapterStep(999_999_999)).rejects.toThrow("Chapter not found");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(expect.objectContaining({ status: "error", step: "getChapter" }));
  });
});
