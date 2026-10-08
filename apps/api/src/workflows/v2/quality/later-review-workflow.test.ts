import { randomUUID } from "node:crypto";
import { writeLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer";
import { fixLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer/fix";
import { checkLessonQuality } from "@zoonk/ai/tasks/v2/quality/lesson-check";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { recordedOutput, taskResult } from "../_test-utils/recorded-outputs";
import { lessonImagesWorkflow } from "../images/lesson-images-workflow";
import { laterReviewWorkflow } from "./later-review-workflow";
import type * as LessonWriter from "@zoonk/ai/tasks/v2/lesson-writer";

vi.mock("workflow/api", () => ({ start: vi.fn(() => Promise.resolve({ runId: "started-run" })) }));

// Model calls are external: the reviewer's verdict is given per lesson, by the lesson's summary,
// and a fresh draft replays the draft recorded for the same lesson.
vi.mock("@zoonk/ai/tasks/v2/quality/lesson-check", () => ({ checkLessonQuality: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/lesson-writer/fix", () => ({ fixLessonDraft: vi.fn() }));

vi.mock("@zoonk/ai/tasks/v2/lesson-writer", async (importOriginal) => ({
  ...(await importOriginal<typeof LessonWriter>()),
  writeLessonDraft: vi.fn(),
}));

type RecordedDraft = Awaited<ReturnType<typeof writeLessonDraft>>["data"];

const [spec] = recordedOutput<{ lessons: object[] }>("lesson-spec").lessons;
const recordedDraft = recordedOutput<RecordedDraft>("lesson-draft");

async function publishedLesson(summary: string) {
  const lesson = await libraryLessonFixture({
    contentStatus: "completed",
    level: "overview",
    spec,
    summary: { ideas: [{ text: summary }] },
  });

  await libraryStepFixture({ lessonId: lesson.id, model: "openai/gpt-6-sol", position: 0 });
  return lesson;
}

function review(severity: "blocking" | "minor") {
  return taskResult({
    issues: [
      {
        fix: "Say what the vaccine contains.",
        kind: "incorrect" as const,
        problem: "Wrong claim.",
        screen: 0,
        severity,
      },
    ],
  });
}

describe(laterReviewWorkflow, () => {
  beforeEach(() => {
    vi.mocked(writeLessonDraft).mockImplementation(async (params) =>
      taskResult(recordedDraft, params.model ?? "openai/gpt-6-sol"),
    );

    vi.mocked(fixLessonDraft).mockImplementation(async (params) =>
      taskResult({ changedScreens: [], lesson: params.lesson }),
    );
  });

  it("replaces a lesson made ahead that fails its later check with a fresh draft, published as its next version", async () => {
    const wrong = `Vaccines contain live germs ${randomUUID()}`;
    const unreviewable = await libraryLessonFixture({ contentStatus: "completed" });

    const [failing, passing] = await Promise.all([
      publishedLesson(wrong),
      publishedLesson(`Vaccines train the immune system ${randomUUID()}`),
    ]);

    vi.mocked(checkLessonQuality).mockImplementation(async ({ lesson }) =>
      review(lesson.summary.includes(wrong) ? "blocking" : "minor"),
    );

    await expect(
      laterReviewWorkflow({ lessonIds: [failing.id, passing.id, unreviewable.id] }),
    ).resolves.toStrictEqual({ replaced: [failing.id], reviewed: 2, setAside: [] });

    // One check per lesson at the flex tier, against the model that wrote it, then the fresh
    // draft's own check before it's published.
    expect(checkLessonQuality).toHaveBeenCalledTimes(3);

    expect(
      vi
        .mocked(checkLessonQuality)
        .mock.calls.slice(0, 2)
        .every(
          ([params]) => params.serviceTier === "flex" && params.writerModel === "openai/gpt-6-sol",
        ),
    ).toBe(true);

    expect(writeLessonDraft).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        heldBackProblems: [
          { problem: "Wrong claim. Fix: Say what the vaccine contains.", screen: 0 },
        ],
        serviceTier: "flex",
      }),
    );

    const [replaced, kept, steps] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: failing.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: passing.id } }),
      prisma.step.findMany({ where: { lessonId: failing.id } }),
    ]);

    // It stays playable the whole time: learners on the old version finish it.
    expect(replaced.contentStatus).toBe("completed");
    expect(kept.contentStatus).toBe("completed");

    expect(
      steps.filter((step) => step.retiredAt === null).every((step) => step.version === 2),
    ).toBe(true);

    expect(
      steps.filter((step) => step.version === 1).every((step) => step.retiredAt !== null),
    ).toBe(true);

    expect(start).toHaveBeenCalledExactlyOnceWith(lessonImagesWorkflow, [
      { analytics: { contentScope: "shared" }, lessonId: failing.id },
    ]);
  });

  it("takes a lesson out of play when it's wrong and no fresh draft passes", async () => {
    const lesson = await publishedLesson(`Vaccines contain live germs ${randomUUID()}`);
    vi.mocked(checkLessonQuality).mockResolvedValue(review("blocking"));

    await expect(laterReviewWorkflow({ lessonIds: [lesson.id] })).resolves.toStrictEqual({
      replaced: [],
      reviewed: 1,
      setAside: [lesson.id],
    });

    // The version that failed counts as the first draft: two fresh ones follow.
    expect(writeLessonDraft).toHaveBeenCalledTimes(2);

    const [stored, steps] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
      prisma.step.findMany({ where: { lessonId: lesson.id } }),
    ]);

    expect(stored).toMatchObject({ contentStatus: "failed", setAsideAt: expect.any(Date) });
    expect(steps.every((step) => step.retiredAt === null && step.version === 1)).toBe(true);
  });

  it("changes nothing when a review fails to run", async () => {
    const lesson = await publishedLesson(`Antibodies bind antigens ${randomUUID()}`);
    vi.mocked(checkLessonQuality).mockRejectedValue(new Error("Provider unavailable"));

    await expect(laterReviewWorkflow({ lessonIds: [lesson.id] })).resolves.toStrictEqual({
      replaced: [],
      reviewed: 0,
      setAside: [],
    });

    expect(start).not.toHaveBeenCalled();

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ contentStatus: "completed" });
  });
});
