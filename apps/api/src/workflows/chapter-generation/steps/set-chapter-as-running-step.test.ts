import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { setChapterAsRunningStep } from "./set-chapter-as-running-step";

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

describe(setChapterAsRunningStep, () => {
  let organizationId: string;
  let courseId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    courseId = course.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("streams error and throws when chapter does not exist", async () => {
    await expect(
      setChapterAsRunningStep({ chapterId: randomUUID(), workflowRunId: "run-id" }),
    ).rejects.toThrow();

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "setChapterAsRunning" }),
    );
  });

  test("updates chapter generation status to running with run ID", async () => {
    const chapter = await chapterFixture({
      courseId,
      organizationId,
      title: `Set Running Chapter ${randomUUID()}`,
    });

    const workflowRunId = `run-${randomUUID()}`;

    await setChapterAsRunningStep({ chapterId: chapter.id, workflowRunId });

    const updated = await prisma.chapter.findUniqueOrThrow({ where: { id: chapter.id } });

    expect(updated.generationStatus).toBe("running");
    expect(updated.generationRunId).toBe(workflowRunId);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "setChapterAsRunning" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "setChapterAsRunning" }),
    );
  });
});
