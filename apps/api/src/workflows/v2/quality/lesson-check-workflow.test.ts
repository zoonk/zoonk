import { generateLessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec";
import { writeLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer";
import { fixLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer/fix";
import { checkLessonQuality } from "@zoonk/ai/tasks/v2/quality/lesson-check";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { getStartMock } from "../../_test-utils/start-mock";
import { recordedOutput, taskResult } from "../_test-utils/recorded-outputs";
import { lessonImagesWorkflow } from "../images/lesson-images-workflow";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { type LessonCheckInput, lessonCheckWorkflow } from "./lesson-check-workflow";
import type * as LessonWriter from "@zoonk/ai/tasks/v2/lesson-writer";

vi.mock("workflow/api", () => ({
  getRun: vi.fn(() => ({ exists: Promise.resolve(false), status: Promise.resolve("failed") })),
  start: vi.fn(() => Promise.resolve({ runId: "started-run" })),
}));

// Model calls are external: tests replay a real spec and draft recorded for the same lesson. The
// writer's model choice for a last draft runs for real.
vi.mock("@zoonk/ai/tasks/v2/lesson-spec", () => ({ generateLessonSpec: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/lesson-writer/fix", () => ({ fixLessonDraft: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/quality/lesson-check", () => ({ checkLessonQuality: vi.fn() }));

vi.mock("@zoonk/ai/tasks/v2/lesson-writer", async (importOriginal) => ({
  ...(await importOriginal<typeof LessonWriter>()),
  writeLessonDraft: vi.fn(),
}));

type RecordedSpec = Awaited<ReturnType<typeof generateLessonSpec>>["data"];
type RecordedDraft = Awaited<ReturnType<typeof writeLessonDraft>>["data"];

const recordedSpec = recordedOutput<RecordedSpec>("lesson-spec");
const recordedDraft = recordedOutput<RecordedDraft>("lesson-draft");

/** What the reviewer finds wrong on the recorded draft's screen 2. */
const wrong = taskResult({
  issues: [
    {
      fix: "Say that vaccines train the immune system without causing the disease.",
      kind: "incorrect" as const,
      problem: "Screen 3 says the vaccine gives a mild case of the disease.",
      screen: 2,
      severity: "blocking" as const,
    },
  ],
});

const fixedDraft: RecordedDraft = {
  ...recordedDraft,
  screens: recordedDraft.screens.map((screen, index) =>
    index === 2 && screen.kind === "explanation"
      ? { ...screen, text: `${screen.text} A vaccine never gives you the disease.` }
      : screen,
  ),
};

/**
 * A lesson of a learner's plan, published by the real content workflow: what the check workflow
 * it starts after publishing receives.
 */
async function publishedLesson() {
  const [chapter, user] = await Promise.all([
    libraryChapterFixture({ title: "How vaccines train the immune system" }),
    userFixture(),
  ]);

  const lesson = await libraryLessonFixture({ homeChapterId: chapter.id, level: "overview" });
  const goal = await goalFixture({ userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  const [item] = await Promise.all([
    planItemFixture({ lessonId: lesson.id, planId: plan.id }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id }),
  ]);

  await lessonContentWorkflow({ forExam: true, lessonId: lesson.id });

  const call = getStartMock().mock.calls.findLast(([workflow]) => workflow === lessonCheckWorkflow);

  const [input] = (call?.[1] ?? []) as [LessonCheckInput?];

  if (!input) {
    throw new Error("The content workflow didn't start the lesson's checks.");
  }

  vi.mocked(start).mockClear();

  return { input, item, lesson };
}

describe(lessonCheckWorkflow, () => {
  beforeEach(() => {
    vi.mocked(generateLessonSpec).mockResolvedValue(taskResult(recordedSpec));

    vi.mocked(writeLessonDraft).mockImplementation(async (params) =>
      taskResult(recordedDraft, params.model ?? "openai/gpt-6-sol"),
    );
  });

  it("leaves a published version its reviewer passes as it is", async () => {
    const { input, lesson } = await publishedLesson();
    vi.mocked(checkLessonQuality).mockResolvedValue(taskResult({ issues: [] }));

    await expect(lessonCheckWorkflow(input)).resolves.toStrictEqual({ cited: 0, status: "passed" });

    expect(checkLessonQuality).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ serviceTier: "flex" }),
    );

    expect(start).not.toHaveBeenCalled();

    const steps = await prisma.step.findMany({ where: { lessonId: lesson.id } });
    expect(steps.every((step) => step.version === 1 && step.retiredAt === null)).toBe(true);
  });

  it("publishes the fix of what its reviewer found as the next version, then draws the pictures it lacks", async () => {
    const { input, lesson } = await publishedLesson();
    vi.mocked(checkLessonQuality).mockResolvedValue(wrong);

    vi.mocked(fixLessonDraft).mockResolvedValue(
      taskResult({ changedScreens: [2], lesson: fixedDraft }),
    );

    await expect(lessonCheckWorkflow(input)).resolves.toStrictEqual({
      cited: 0,
      status: "republished",
    });

    const current = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id, retiredAt: null },
    });

    expect(current.every((step) => step.version === 2)).toBe(true);

    expect(current[2]?.content).toMatchObject({
      text: expect.stringContaining("A vaccine never gives you the disease."),
    });

    expect(start).toHaveBeenCalledExactlyOnceWith(lessonImagesWorkflow, [
      { analytics: { contentScope: "shared" }, lessonId: lesson.id },
    ]);
  });

  it("drafts a version no fix put right afresh, and takes a wrong one out of play when no draft passes", async () => {
    const { input, item, lesson } = await publishedLesson();
    vi.mocked(checkLessonQuality).mockResolvedValue(wrong);

    vi.mocked(fixLessonDraft).mockImplementation(async (params) =>
      taskResult({ changedScreens: [], lesson: params.lesson }),
    );

    await expect(lessonCheckWorkflow(input)).resolves.toStrictEqual({
      cited: 0,
      status: "setAside",
    });

    // The published version counts as the first draft: two fresh ones follow, the last by a writer
    // of another family, each told what held the earlier ones back.
    const drafts = vi
      .mocked(writeLessonDraft)
      .mock.calls.slice(-2)
      .map(([params]) => params);

    expect(drafts.map((params) => params.heldBackProblems?.length)).toStrictEqual([1, 2]);
    expect(drafts.every((params) => params.serviceTier === "flex")).toBe(true);

    const [stored, planItem, steps] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
      prisma.planItem.findUniqueOrThrow({ where: { id: item.id } }),
      prisma.step.findMany({ where: { lessonId: lesson.id } }),
    ]);

    // Plans move on; learners playing the version they opened finish it.
    expect(stored).toMatchObject({ contentStatus: "failed", setAsideAt: expect.any(Date) });
    expect(planItem.status).toBe("skipped");
    expect(steps.every((step) => step.version === 1 && step.retiredAt === null)).toBe(true);
  });
});
