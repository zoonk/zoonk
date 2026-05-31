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

  it("returns false when chapter does not exist", async () => {
    const result = await setChapterAsRunningStep({
      chapterId: randomUUID(),
      workflowRunId: "run-id",
    });

    const events = getStreamedEvents();

    expect(result).toBe(false);

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "setChapterAsRunning" }),
    );
  });

  it("updates chapter generation status to running with run ID", async () => {
    const chapter = await chapterFixture({
      courseId,
      generationStatus: "pending",
      organizationId,
      title: `Set Running Chapter ${randomUUID()}`,
    });

    const workflowRunId = `run-${randomUUID()}`;

    const result = await setChapterAsRunningStep({ chapterId: chapter.id, workflowRunId });

    const updated = await prisma.chapter.findUniqueOrThrow({ where: { id: chapter.id } });

    expect(result).toBe(true);
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

  it("does not overwrite a chapter already claimed by another workflow", async () => {
    const chapter = await chapterFixture({
      courseId,
      generationRunId: "workflow-running-1",
      generationStatus: "running",
      organizationId,
      title: `Already Running Chapter ${randomUUID()}`,
    });

    const result = await setChapterAsRunningStep({
      chapterId: chapter.id,
      workflowRunId: "workflow-running-2",
    });

    const updated = await prisma.chapter.findUniqueOrThrow({ where: { id: chapter.id } });

    expect(result).toBe(false);
    expect(updated.generationRunId).toBe("workflow-running-1");
    expect(updated.generationStatus).toBe("running");
  });
});
