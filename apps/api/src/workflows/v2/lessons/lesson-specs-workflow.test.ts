import { generateLessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec";
import { trackServerEvent, trackSystemEvent } from "@zoonk/core/analytics/server";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { recordedOutput, taskResult } from "../_test-utils/recorded-outputs";
import { lessonSpecsWorkflow } from "./lesson-specs-workflow";

/** The only run still working is "live-run"; any other run that holds a claim has stopped. */
vi.mock("workflow/api", () => ({
  getRun: vi.fn((runId: string) => ({
    exists: Promise.resolve(runId === "live-run"),
    status: Promise.resolve("running"),
  })),
}));

// Model calls are external: the test decides whether the spec writer answers.
vi.mock("@zoonk/ai/tasks/v2/lesson-spec", () => ({ generateLessonSpec: vi.fn() }));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("@zoonk/core/analytics/server", () => ({
  trackServerEvent: vi.fn(),
  trackSystemEvent: vi.fn(),
}));

type RecordedSpec = Awaited<ReturnType<typeof generateLessonSpec>>["data"];

const recordedSpec = recordedOutput<RecordedSpec>("lesson-spec");

async function outlinedLesson(attrs: Parameters<typeof libraryLessonFixture>[0] = {}) {
  const chapter = await libraryChapterFixture({ title: "How vaccines train the immune system" });

  const lesson = await libraryLessonFixture({
    homeChapterId: chapter.id,
    level: "overview",
    ...attrs,
  });

  await chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id });

  return lesson;
}

describe(lessonSpecsWorkflow, () => {
  it("frees a lesson whose spec failed and counts it for the learner whose client started the run", async () => {
    const [lesson, user] = await Promise.all([outlinedLesson(), userFixture()]);
    const goal = await goalFixture({ userId: user.id });

    vi.mocked(generateLessonSpec).mockRejectedValue(new Error("Provider unavailable"));

    await expect(
      lessonSpecsWorkflow({
        analytics: { distinctId: user.id, goalId: goal.id, platform: "web" },
        lessonIds: [lesson.id],
      }),
    ).resolves.toStrictEqual({ failed: 1, planned: 0, skipped: 0 });

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ specStatus: "failed" });

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Generation Failed",
        properties: { content_kind: "lesson", model: null, task: "lesson-specs" },
        shared: expect.objectContaining({ platform: "web" }),
      }),
    );
  });

  it("plans every lesson it can and frees only the one whose spec failed", async () => {
    const [planned, failed] = await Promise.all([
      outlinedLesson({ title: "Innate immune detection" }),
      outlinedLesson({ title: "Memory cells" }),
    ]);

    vi.mocked(generateLessonSpec).mockImplementation(async ({ lessonTitle }) => {
      if (lessonTitle === failed.title) {
        throw new Error("Provider unavailable");
      }

      return taskResult(recordedSpec);
    });

    await expect(
      lessonSpecsWorkflow({ lessonIds: [planned.id, failed.id] }),
    ).resolves.toStrictEqual({ failed: 1, planned: 1, skipped: 0 });

    const [plannedRow, failedRow] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: planned.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: failed.id } }),
    ]);

    expect(plannedRow).toMatchObject({
      canDo: recordedSpec.lessons[0]?.canDo,
      specRunId: "test-run-id",
      specStatus: "completed",
    });

    expect(failedRow.specStatus).toBe("failed");

    // A run no learner started, like the one a session starts for the next chapter's lessons.
    expect(trackSystemEvent).toHaveBeenCalledExactlyOnceWith({
      name: "Generation Failed",
      properties: { content_kind: "lesson", model: null, task: "lesson-specs" },
    });
  });

  it("leaves a lesson a live run is planning to it, takes over one a stopped run left, and never plans a lesson twice", async () => {
    const [live, stopped, done] = await Promise.all([
      outlinedLesson({ specRunId: "live-run", specStatus: "running" }),
      outlinedLesson({ specRunId: "stopped-run", specStatus: "running" }),
      outlinedLesson({ spec: recordedSpec.lessons[0], specStatus: "completed" }),
    ]);

    vi.mocked(generateLessonSpec).mockResolvedValue(taskResult(recordedSpec));

    await expect(
      lessonSpecsWorkflow({ lessonIds: [live.id, stopped.id, done.id] }),
    ).resolves.toStrictEqual({ failed: 0, planned: 2, skipped: 1 });

    expect(generateLessonSpec).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ lessonTitle: stopped.title }),
    );

    const [liveRow, stoppedRow] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: live.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: stopped.id } }),
    ]);

    expect(liveRow).toMatchObject({ specRunId: "live-run", specStatus: "running" });
    expect(stoppedRow).toMatchObject({ specRunId: "test-run-id", specStatus: "completed" });
  });
});
