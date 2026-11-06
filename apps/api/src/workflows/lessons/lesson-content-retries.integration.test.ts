import { tagLesson } from "@zoonk/ai/tasks/lesson-marks";
import { generateLessonSpec } from "@zoonk/ai/tasks/lesson-spec";
import { judgePicture } from "@zoonk/ai/tasks/lesson-spec/picture-need";
import { writeLessonDraft } from "@zoonk/ai/tasks/lesson-writer";
import { fixLessonDraft } from "@zoonk/ai/tasks/lesson-writer/fix";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { chapterLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { getRun, start } from "workflow/api";
import { startOnce } from "../_shared/run-token";
import { recordedLessonFixture } from "../_test-utils/recorded-lesson";
import { recordedOutput, taskResult } from "../_test-utils/recorded-outputs";
import { getLessonContentHookToken } from "./lesson-content-result";
import { lessonContentWorkflow } from "./lesson-content-workflow";

vi.mock("@zoonk/ai/tasks/lesson-marks", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  tagLesson: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/images/scene", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateImageScene: vi.fn().mockRejectedValue(new Error("Pictures unavailable")),
}));

vi.mock("@zoonk/ai/tasks/lesson-spec", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateLessonSpec: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/lesson-spec/picture-need", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  judgePicture: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/lesson-writer", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  writeLessonDraft: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/lesson-writer/fix", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fixLessonDraft: vi.fn(),
}));

type Draft = Awaited<ReturnType<typeof writeLessonDraft>>["data"];
type Spec = Awaited<ReturnType<typeof generateLessonSpec>>["data"];
const recorded = recordedOutput<Draft>("lesson-draft");
const recordedSpec = recordedOutput<Spec>("lesson-spec");

const heldBack: Draft = {
  ...recorded,
  screens: recorded.screens.map((screen, index) =>
    index === 2 && screen.kind === "explanation"
      ? { ...screen, text: `It's worth noting that ${screen.text}` }
      : screen,
  ),
};

describe("lesson draft durability", () => {
  it("opens the lesson once its marks are saved and its pictures have failed", async () => {
    vi.mocked(writeLessonDraft).mockReset().mockResolvedValue(taskResult(recorded));

    vi.mocked(tagLesson).mockResolvedValue({
      data: {
        ideas: recorded.summary.ideas.map(() => ({ about: null, icon: null })),
        screens: recorded.screens.map(() => ({
          example: null,
          icon: null,
          ideaIndex: 0,
          underline: null,
        })),
      },
    } as never);

    const [chapter, owner] = await Promise.all([libraryChapterFixture(), userFixture()]);

    const lesson = await recordedLessonFixture({
      homeChapterId: chapter.id,
      ownerId: owner.id,
      spec: recordedSpec.lessons[0],
      specStatus: "completed",
      visibility: "private",
    });

    await chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id });

    const run = await start(lessonContentWorkflow, [{ lessonId: lesson.id }]);
    await expect(run.returnValue).resolves.toStrictEqual({ lessonId: lesson.id, status: "ready" });

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ contentRunId: run.runId, contentStatus: "completed" });

    expect(writeLessonDraft).toHaveBeenCalledOnce();
    expect(tagLesson).toHaveBeenCalledOnce();
  }, 60_000);

  it.each([1, 2])(
    "retries only fix %i, retaining every successful model result",
    async (failedFix) => {
      vi.mocked(writeLessonDraft).mockReset().mockResolvedValue(taskResult(heldBack));
      vi.mocked(fixLessonDraft).mockReset().mockRejectedValue(new Error("Fix unavailable"));

      if (failedFix === 2) {
        vi.mocked(fixLessonDraft).mockResolvedValueOnce(
          taskResult({ changedScreens: [2], lesson: heldBack }),
        );
      }

      const [chapter, owner] = await Promise.all([libraryChapterFixture(), userFixture()]);

      const spec = recordedSpec.lessons[0];

      const lesson = await recordedLessonFixture({
        homeChapterId: chapter.id,
        ownerId: owner.id,
        spec,
        specStatus: "completed",
        visibility: "private",
      });

      const goal = await goalFixture({ userId: owner.id });
      const plan = await planFixture({ goalId: goal.id });

      await Promise.all([
        planItemFixture({ lessonId: lesson.id, planId: plan.id }),
        chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id }),
      ]);

      const run = await start(lessonContentWorkflow, [{ lessonId: lesson.id }]);
      await expect(run.returnValue).rejects.toThrow("Fix unavailable");
      expect(writeLessonDraft).toHaveBeenCalledOnce();
      expect(fixLessonDraft).toHaveBeenCalledTimes(failedFix + 3);
    },
  );

  it("retries only the picture judgment that failed, never planning the lesson again", async () => {
    const pictures = [
      ...new Set(
        (recordedSpec.lessons[0]?.screens ?? []).flatMap((screen) =>
          screen.visual ? [screen.visual] : [],
        ),
      ),
    ];

    const [failing] = pictures;
    vi.mocked(generateLessonSpec).mockReset().mockResolvedValue(taskResult(recordedSpec));

    vi.mocked(judgePicture)
      .mockReset()
      .mockImplementation(async ({ picture }) => {
        if (picture === failing) {
          throw new Error("Judge unavailable");
        }

        return true;
      });

    const chapter = await libraryChapterFixture();
    const lesson = await recordedLessonFixture({ homeChapterId: chapter.id, level: "beginner" });
    await chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id });

    const run = await start(lessonContentWorkflow, [{ lessonId: lesson.id }]);
    await expect(run.returnValue).rejects.toThrow("Judge unavailable");

    const calls = vi.mocked(judgePicture).mock.calls.map(([input]) => input.picture);

    expect(generateLessonSpec).toHaveBeenCalledOnce();
    expect(calls.filter((picture) => picture === failing)).toHaveLength(4);
    expect(calls.filter((picture) => picture !== failing)).toHaveLength(pictures.length - 1);
  });
});

async function unwrittenLesson() {
  const [chapter, owner] = await Promise.all([libraryChapterFixture(), userFixture()]);

  const lesson = await recordedLessonFixture({
    homeChapterId: chapter.id,
    ownerId: owner.id,
    spec: recordedSpec.lessons[0],
    specStatus: "completed",
    visibility: "private",
  });

  await chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id });
  return lesson;
}

function holdDraft() {
  const release = Promise.withResolvers<null>();

  vi.mocked(writeLessonDraft)
    .mockReset()
    .mockImplementation(async () => {
      await release.promise;
      return taskResult(recorded);
    });

  vi.mocked(tagLesson).mockResolvedValue({
    data: {
      ideas: recorded.summary.ideas.map(() => ({ about: null, icon: null })),
      screens: recorded.screens.map(() => ({
        example: null,
        icon: null,
        ideaIndex: 0,
        underline: null,
      })),
    },
  } as never);

  return () => release.resolve(null);
}

function startForLearner(lessonId: string) {
  return startOnce(
    lessonContentWorkflow,
    [{ lessonId, wait: "learner" }],
    getLessonContentHookToken(lessonId),
  );
}

async function untilDrafting() {
  await vi.waitFor(() => expect(writeLessonDraft).toHaveBeenCalledOnce(), {
    interval: 100,
    timeout: 10_000,
  });
}

describe("a learner's start beside a plan's", () => {
  it("follows the plan's run already writing the lesson", async () => {
    const lesson = await unwrittenLesson();
    const release = holdDraft();

    const plan = await start(lessonContentWorkflow, [{ lessonId: lesson.id }]);
    await untilDrafting();

    await expect(startForLearner(lesson.id)).resolves.toBe(plan.runId);

    release();
    await expect(plan.returnValue).resolves.toStrictEqual({ lessonId: lesson.id, status: "ready" });
    expect(writeLessonDraft).toHaveBeenCalledOnce();
  }, 60_000);

  it("leaves the lesson to the learner's run when a plan's run starts after it", async () => {
    const lesson = await unwrittenLesson();
    const release = holdDraft();

    const learner = await startForLearner(lesson.id);
    await untilDrafting();

    const plan = await start(lessonContentWorkflow, [{ lessonId: lesson.id }]);
    await expect(plan.returnValue).resolves.toStrictEqual({ lessonId: lesson.id, status: "busy" });

    release();

    await expect(getRun(learner).returnValue).resolves.toStrictEqual({
      lessonId: lesson.id,
      status: "ready",
    });

    expect(writeLessonDraft).toHaveBeenCalledOnce();

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ contentRunId: learner, contentStatus: "completed" });
  }, 60_000);
});
