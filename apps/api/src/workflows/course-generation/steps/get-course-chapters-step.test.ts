import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { getCourseChaptersStep } from "./get-course-chapters-step";

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

describe(getCourseChaptersStep, () => {
  let organizationId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns chapters ordered by position", async () => {
    const course = await courseFixture({ organizationId });

    await Promise.all([
      chapterFixture({
        courseId: course.id,
        organizationId,
        position: 1,
        title: `Chapter B ${randomUUID()}`,
      }),
      chapterFixture({
        courseId: course.id,
        organizationId,
        position: 0,
        title: `Chapter A ${randomUUID()}`,
      }),
    ]);

    const result = await getCourseChaptersStep(course.id);

    expect(result).toHaveLength(2);
    expect(result[0]!.position).toBe(0);
    expect(result[1]!.position).toBe(1);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "getExistingChapters" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "getExistingChapters" }),
    );
  });

  test("returns empty array for a course with no chapters", async () => {
    const emptyCourse = await courseFixture({ organizationId });

    const result = await getCourseChaptersStep(emptyCourse.id);

    expect(result).toEqual([]);
  });
});
