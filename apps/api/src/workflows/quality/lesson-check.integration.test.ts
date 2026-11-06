import { randomUUID } from "node:crypto";
import { tagLesson } from "@zoonk/ai/tasks/lesson-marks";
import { writeLessonDraft } from "@zoonk/ai/tasks/lesson-writer";
import { fixLessonDraft } from "@zoonk/ai/tasks/lesson-writer/fix";
import { checkLessonQuality } from "@zoonk/ai/tasks/quality/lesson-check";
import { completeLessonContent } from "@zoonk/core/library/generation/state";
import { prisma } from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { chapterLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { writeLessonContent } from "../../../../../packages/core/src/_test-utils/write-lesson-content";
import { recordedLessonFixture } from "../_test-utils/recorded-lesson";
import { recordedOutput, taskResult } from "../_test-utils/recorded-outputs";
import { lessonCheckWorkflow } from "./lesson-check-workflow";

vi.mock("@zoonk/ai/tasks/lesson-marks", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  tagLesson: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/images/scene", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateImageScene: vi.fn().mockRejectedValue(new Error("Pictures unavailable")),
}));

vi.mock("@zoonk/ai/tasks/lesson-writer", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  writeLessonDraft: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/lesson-writer/fix", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fixLessonDraft: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/quality/lesson-check", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  checkLessonQuality: vi.fn(),
}));

type Draft = Awaited<ReturnType<typeof writeLessonDraft>>["data"];
const recorded = recordedOutput<Draft>("lesson-draft");
const [recordedSpec] = recordedOutput<{ lessons: object[] }>("lesson-spec").lessons;
const FIX = "A vaccine never gives you the disease.";

const fixed: Draft = {
  ...recorded,
  screens: recorded.screens.map((screen, index) =>
    index === 2 && screen.kind === "explanation"
      ? { ...screen, text: `${screen.text} ${FIX}` }
      : screen,
  ),
};

async function publishedLesson() {
  const workflowRunId = randomUUID();
  const chapter = await libraryChapterFixture();

  const lesson = await recordedLessonFixture({
    contentRunId: workflowRunId,
    contentStatus: "running",
    homeChapterId: chapter.id,
    spec: recordedSpec,
    specStatus: "completed",
  });

  await chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id });
  const written = await writeLessonContent({ forExam: true, lessonId: lesson.id, workflowRunId });

  if (written.status !== "published") {
    throw new Error(`The test lesson wasn't published: ${written.status}`);
  }

  await completeLessonContent({ lessonId: lesson.id, workflowRunId });
  return { lesson, plan: written.check };
}

describe("a fixed lesson version", () => {
  it("replaces the version learners get once its marks are saved and its pictures have failed", async () => {
    vi.mocked(writeLessonDraft).mockReset().mockResolvedValue(taskResult(recorded));
    vi.mocked(fixLessonDraft).mockResolvedValue(taskResult({ changedScreens: [2], lesson: fixed }));

    vi.mocked(tagLesson).mockImplementation(
      async ({ ideas, screens }) =>
        ({
          data: {
            ideas: ideas.map(() => ({ about: null, icon: null })),
            screens: screens.map(() => ({
              example: null,
              icon: null,
              ideaIndex: 0,
              underline: null,
            })),
          },
        }) as never,
    );

    const { lesson, plan } = await publishedLesson();

    vi.mocked(checkLessonQuality).mockResolvedValue(
      taskResult({
        issues: [
          {
            fix: "Say that vaccines train the immune system without causing the disease.",
            kind: "incorrect" as const,
            problem: "Screen 3 says the vaccine gives a mild case of the disease.",
            screen: 2,
            severity: "blocking" as const,
          },
        ],
      }),
    );

    const run = await start(lessonCheckWorkflow, [{ lessonId: lesson.id, plan }]);
    await expect(run.returnValue).resolves.toMatchObject({ status: "republished" });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id, retiredAt: null },
    });

    expect(steps.every((step) => step.version === 2 && !step.staged)).toBe(true);
    expect(JSON.stringify(steps.map((step) => step.content))).toContain(FIX);
    expect(steps.some((step) => step.marks !== null)).toBe(true);
    expect(tagLesson).toHaveBeenCalledOnce();
  }, 60_000);
});
