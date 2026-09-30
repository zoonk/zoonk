import { randomUUID } from "node:crypto";
import { generateChallengeCase } from "@zoonk/ai/tasks/v2/challenge/case";
import { generateLessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec";
import { writeLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer";
import { checkLessonQuality } from "@zoonk/ai/tasks/v2/quality/lesson-check";
import { trackSystemEvent } from "@zoonk/core/analytics/server";
import { prisma } from "@zoonk/db";
import { writtenChallengeCaseFixture } from "@zoonk/testing/fixtures/challenge-written-case";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sleep } from "workflow";
import { getRun, start } from "workflow/api";
import { mockHookConflict } from "../../../../mocks/workflow";
import { getStreamedEvents } from "../../_test-utils/parse-stream-events";
import { recordedOutput, taskResult } from "../_test-utils/recorded-outputs";
import { lessonImagesWorkflow } from "../images/lesson-images-workflow";
import { lessonContentWorkflow } from "./lesson-content-workflow";

vi.mock("workflow/api", () => ({
  getRun: vi.fn(() => ({ exists: Promise.resolve(false), status: Promise.resolve("failed") })),
  start: vi.fn(() => Promise.resolve({ runId: "started-run" })),
}));

// Model calls are external: tests replay a real spec and draft recorded for the same lesson.
vi.mock("@zoonk/ai/tasks/v2/lesson-spec", () => ({ generateLessonSpec: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/lesson-writer", () => ({ writeLessonDraft: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/quality/lesson-check", () => ({ checkLessonQuality: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/challenge/case", () => ({ generateChallengeCase: vi.fn() }));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("@zoonk/core/analytics/server", () => ({
  trackServerEvent: vi.fn(),
  trackSystemEvent: vi.fn(),
}));

type RecordedSpec = Awaited<ReturnType<typeof generateLessonSpec>>["data"];
type RecordedDraft = Awaited<ReturnType<typeof writeLessonDraft>>["data"];

const recordedSpec = recordedOutput<RecordedSpec>("lesson-spec");
const recordedDraft = recordedOutput<RecordedDraft>("lesson-draft");

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

function runOwner({ active }: { active: boolean }) {
  vi.mocked(getRun).mockReturnValue({
    exists: Promise.resolve(true),
    status: Promise.resolve(active ? "running" : "failed"),
  } as unknown as ReturnType<typeof getRun>);
}

describe(lessonContentWorkflow, () => {
  beforeEach(() => {
    vi.mocked(generateLessonSpec).mockResolvedValue(taskResult(recordedSpec));
    vi.mocked(writeLessonDraft).mockResolvedValue(taskResult(recordedDraft));

    vi.mocked(checkLessonQuality).mockResolvedValue(
      taskResult({ issues: [] }, "anthropic/claude-opus-5.5"),
    );
  });

  it("plans and writes a lesson, streams its progress and starts its pictures in the background", async () => {
    const lesson = await outlinedLesson();

    await expect(
      lessonContentWorkflow({ analytics: { distinctId: "learner" }, lessonId: lesson.id }),
    ).resolves.toStrictEqual({ lessonId: lesson.id, status: "ready" });

    const stored = await prisma.lesson.findUniqueOrThrow({
      include: { steps: true },
      where: { id: lesson.id },
    });

    expect(stored).toMatchObject({
      canDo: recordedSpec.lessons[0]?.canDo,
      contentStatus: "completed",
      specStatus: "completed",
    });

    expect(stored.steps).toHaveLength(recordedDraft.screens.length);

    expect(
      getStreamedEvents().map((event) => `${String(event.step)}:${String(event.status)}`),
    ).toStrictEqual([
      "planLesson:started",
      "planLesson:completed",
      "writeLesson:started",
      "writeLesson:completed",
      "lessonReady:completed",
    ]);

    expect(start).toHaveBeenCalledWith(lessonImagesWorkflow, [
      {
        analytics: { contentScope: "shared", distinctId: "learner" },
        lessonId: lesson.id,
        maxImages: undefined,
      },
    ]);
  });

  it("plans and writes a lesson a learner waits on at the priority tier, and one written ahead at the standard tier", async () => {
    const [waitedOn, ahead] = await Promise.all([outlinedLesson(), outlinedLesson()]);
    vi.mocked(generateLessonSpec).mockClear();
    vi.mocked(writeLessonDraft).mockClear();

    await lessonContentWorkflow({ lessonId: waitedOn.id, priority: true });
    await lessonContentWorkflow({ lessonId: ahead.id });

    expect(
      vi.mocked(generateLessonSpec).mock.calls.map(([params]) => params.serviceTier),
    ).toStrictEqual(["priority", undefined]);

    expect(
      vi.mocked(writeLessonDraft).mock.calls.map(([params]) => params.serviceTier),
    ).toStrictEqual(["priority", undefined]);
  });

  it("joins the run already writing the lesson and ends with its result", async () => {
    const lesson = await outlinedLesson();

    mockHookConflict({
      returnValue: Promise.resolve({ lessonId: lesson.id, status: "ready" }),
      runId: "owner-run",
    });

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      lessonId: lesson.id,
      status: "ready",
    });

    expect(generateLessonSpec).not.toHaveBeenCalled();

    expect(getStreamedEvents()).toStrictEqual([
      { entityId: "owner-run", status: "started", step: "joinRunningLesson" },
      { entityId: lesson.id, status: "completed", step: "lessonReady" },
    ]);
  });

  it("answers at once for a lesson already written", async () => {
    const lesson = await outlinedLesson({ contentStatus: "completed" });

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      lessonId: lesson.id,
      status: "ready",
    });

    expect(writeLessonDraft).not.toHaveBeenCalled();
  });

  it("takes over a lesson whose claim a stopped run left, reusing the spec already written", async () => {
    const lesson = await outlinedLesson({
      contentRunId: "stopped-run",
      contentStatus: "running",
      spec: recordedSpec.lessons[0],
      specStatus: "completed",
    });

    runOwner({ active: false });

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).resolves.toMatchObject({
      status: "ready",
    });

    expect(generateLessonSpec).not.toHaveBeenCalled();
    expect(writeLessonDraft).toHaveBeenCalledOnce();
  });

  it("waits for a live run outside the lesson's hook, such as an explanation saving it", async () => {
    const lesson = await outlinedLesson({ contentRunId: "other-run", contentStatus: "running" });
    runOwner({ active: true });

    vi.mocked(sleep).mockImplementation(async () => {
      await prisma.lesson.update({
        data: { contentStatus: "completed" },
        where: { id: lesson.id },
      });
    });

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      lessonId: lesson.id,
      status: "ready",
    });

    expect(writeLessonDraft).not.toHaveBeenCalled();
  });

  it("waits for a live run planning the lesson's spec, then writes the lesson from that spec", async () => {
    const lesson = await outlinedLesson({ specRunId: "other-run", specStatus: "running" });
    runOwner({ active: true });

    vi.mocked(sleep).mockImplementation(async () => {
      await prisma.lesson.update({
        data: { spec: recordedSpec.lessons[0], specStatus: "completed" },
        where: { id: lesson.id },
      });
    });

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      lessonId: lesson.id,
      status: "ready",
    });

    expect(generateLessonSpec).not.toHaveBeenCalled();
    expect(writeLessonDraft).toHaveBeenCalledOnce();
  });

  it("frees the lesson for the next run when writing fails, and counts the failure", async () => {
    const lesson = await outlinedLesson();
    vi.mocked(writeLessonDraft).mockRejectedValue(new Error("Provider unavailable"));

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).rejects.toThrow(
      "Provider unavailable",
    );

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ contentStatus: "failed", specStatus: "completed" });

    // A rewrite no learner asked for (a later check or a changed source) counts under the system.
    expect(trackSystemEvent).toHaveBeenCalledExactlyOnceWith({
      name: "Generation Failed",
      properties: { content_kind: "lesson", model: null, task: "lesson-content" },
    });

    // A learner waiting on it hears it failed, so their screen offers to try again.
    expect(getStreamedEvents().at(-1)).toMatchObject({
      reason: "aiGenerationFailed",
      status: "error",
      step: "workflowError",
    });
  });

  it("tells the waiting screens the lesson is ready before its pictures start", async () => {
    const lesson = await outlinedLesson();
    const readyWhenPicturesStart: boolean[] = [];

    vi.mocked(start).mockImplementationOnce(async () => {
      readyWhenPicturesStart.push(
        getStreamedEvents().some((event) => event.step === "lessonReady"),
      );

      return { runId: "pictures-run" } as Awaited<ReturnType<typeof start>>;
    });

    await lessonContentWorkflow({ lessonId: lesson.id });

    expect(readyWhenPicturesStart).toStrictEqual([true]);
  });

  it("gives a lesson made for one learner a single picture, counted as theirs", async () => {
    const user = await userFixture();
    const lesson = await outlinedLesson({ ownerId: user.id, visibility: "private" });

    await expect(
      lessonContentWorkflow({ analytics: { distinctId: user.id }, lessonId: lesson.id }),
    ).resolves.toStrictEqual({ lessonId: lesson.id, status: "ready" });

    expect(start).toHaveBeenCalledExactlyOnceWith(lessonImagesWorkflow, [
      {
        analytics: { contentScope: "personal", distinctId: user.id },
        lessonId: lesson.id,
        maxImages: 1,
      },
    ]);
  });

  it("draws no pictures for a guest's own lesson", async () => {
    const guest = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });
    const lesson = await outlinedLesson({ ownerId: guest.id, visibility: "private" });

    await expect(
      lessonContentWorkflow({ analytics: { distinctId: guest.id }, lessonId: lesson.id }),
    ).resolves.toStrictEqual({ lessonId: lesson.id, status: "ready" });

    expect(start).not.toHaveBeenCalledWith(lessonImagesWorkflow, expect.anything());
  });

  it("frees both of the lesson's claims when planning it fails", async () => {
    const lesson = await outlinedLesson();
    vi.mocked(generateLessonSpec).mockRejectedValue(new Error("Provider unavailable"));

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).rejects.toThrow(
      "Provider unavailable",
    );

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ contentStatus: "failed", specStatus: "failed" });

    expect(writeLessonDraft).not.toHaveBeenCalled();

    expect(trackSystemEvent).toHaveBeenCalledExactlyOnceWith({
      name: "Generation Failed",
      properties: { content_kind: "lesson", model: null, task: "lesson-content" },
    });
  });

  it("writes a chapter's challenge with the case writer, without a spec step or pictures", async () => {
    const lesson = await outlinedLesson({
      spec: {
        kind: "challenge",
        skills: [{ description: null, name: "Judge whether a gap is chance" }],
        variant: "work",
      },
      specStatus: "completed",
    });

    vi.mocked(generateChallengeCase).mockResolvedValue(taskResult(writtenChallengeCaseFixture()));

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      lessonId: lesson.id,
      status: "ready",
    });

    await expect(
      prisma.step.findMany({ select: { kind: true }, where: { lessonId: lesson.id } }),
    ).resolves.toStrictEqual([{ kind: "challenge" }]);

    expect(generateLessonSpec).not.toHaveBeenCalled();
    expect(writeLessonDraft).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it("reports a lesson that no longer exists", async () => {
    const lessonId = randomUUID();

    await expect(lessonContentWorkflow({ lessonId })).resolves.toStrictEqual({
      lessonId,
      status: "missing",
    });

    expect(getStreamedEvents()).toStrictEqual([
      {
        entityId: lessonId,
        reason: "contentValidationFailed",
        status: "error",
        step: "workflowError",
      },
    ]);
  });
});
