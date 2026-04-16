import { randomUUID } from "node:crypto";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { getExistingContentSteps } from "./content-step-helpers";

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

describe(getExistingContentSteps, () => {
  let organizationId: string;
  let chapterId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Content Helpers Chapter ${randomUUID()}`,
    });
    chapterId = chapter.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns parsed static text steps ordered by position", async () => {
    const lesson = await lessonFixture({
      chapterId,
      organizationId,
      title: `Content Steps ${randomUUID()}`,
    });

    const activity = await activityFixture({
      kind: "explanation",
      lessonId: lesson.id,
      organizationId,
      title: `Content Activity ${randomUUID()}`,
    });

    await Promise.all([
      stepFixture({
        activityId: activity.id,
        content: { text: "Second step", title: "Title 2", variant: "text" },
        kind: "static",
        position: 1,
      }),
      stepFixture({
        activityId: activity.id,
        content: { text: "First step", title: "Title 1", variant: "text" },
        kind: "static",
        position: 0,
      }),
    ]);

    const result = await getExistingContentSteps(activity.id);

    expect(result).toEqual([
      { text: "First step", title: "Title 1" },
      { text: "Second step", title: "Title 2" },
    ]);
  });

  test("returns empty array when no static steps exist", async () => {
    const lesson = await lessonFixture({
      chapterId,
      organizationId,
      title: `No Steps ${randomUUID()}`,
    });

    const activity = await activityFixture({
      kind: "explanation",
      lessonId: lesson.id,
      organizationId,
      title: `Empty Activity ${randomUUID()}`,
    });

    const result = await getExistingContentSteps(activity.id);

    expect(result).toEqual([]);
  });

  test("returns empty array when content cannot be parsed", async () => {
    const lesson = await lessonFixture({
      chapterId,
      organizationId,
      title: `Bad Content ${randomUUID()}`,
    });

    const activity = await activityFixture({
      kind: "explanation",
      lessonId: lesson.id,
      organizationId,
      title: `Bad Content Activity ${randomUUID()}`,
    });

    await stepFixture({
      activityId: activity.id,
      content: { invalid: true },
      kind: "static",
      position: 0,
    });

    const result = await getExistingContentSteps(activity.id);

    expect(result).toEqual([]);
  });
});
