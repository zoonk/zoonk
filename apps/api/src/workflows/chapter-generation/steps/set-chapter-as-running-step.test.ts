import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setChapterAsRunningStep } from "./set-chapter-as-running-step";

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

  it("throws without streaming error when chapter does not exist", async () => {
    await expect(
      setChapterAsRunningStep({ chapterId: randomUUID(), workflowRunId: "run-id" }),
    ).rejects.toThrow();

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "setChapterAsRunning" }),
    );
  });

  it("updates chapter generation status to running with run ID", async () => {
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

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "setChapterAsRunning" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "setChapterAsRunning" }),
    );
  });
});
