import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type ChapterContext } from "./get-chapter-step";
import { setChapterAsCompletedStep } from "./set-chapter-as-completed-step";

describe(setChapterAsCompletedStep, () => {
  let organizationId: string;
  let course: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    course = await courseFixture({ organizationId });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws without streaming error when chapter does not exist", async () => {
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Broken Chapter ${randomUUID()}`,
    });

    const brokenContext: ChapterContext = {
      ...chapter,
      _count: { lessons: 0 },
      course,
      id: randomUUID(),
      neighboringChapters: [],
    };

    await expect(
      setChapterAsCompletedStep({ context: brokenContext, workflowRunId: "run-id" }),
    ).rejects.toThrow();

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "setChapterAsCompleted" }),
    );
  });

  it("updates chapter generation status to completed", async () => {
    const chapter = await chapterFixture({
      courseId: course.id,
      generationStatus: "running",
      organizationId,
      title: `Set Completed Chapter ${randomUUID()}`,
    });

    const workflowRunId = `run-${randomUUID()}`;

    const context: ChapterContext = {
      ...chapter,
      _count: { lessons: 0 },
      course,
      neighboringChapters: [],
    };

    await setChapterAsCompletedStep({ context, workflowRunId });

    const updated = await prisma.chapter.findUniqueOrThrow({ where: { id: chapter.id } });

    expect(updated.generationStatus).toBe("completed");
    expect(updated.generationRunId).toBe(workflowRunId);

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "setChapterAsCompleted" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "setChapterAsCompleted" }),
    );
  });
});
