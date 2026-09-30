import { randomUUID } from "node:crypto";
import { checkLessonQuality } from "@zoonk/ai/tasks/v2/quality/lesson-check";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { recordedOutput, taskResult } from "../_test-utils/recorded-outputs";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { laterReviewWorkflow } from "./later-review-workflow";

vi.mock("workflow/api", () => ({ start: vi.fn(() => Promise.resolve({ runId: "started-run" })) }));

// The reviewer is a model call: its verdict is given per lesson, by the lesson's summary.
vi.mock("@zoonk/ai/tasks/v2/quality/lesson-check", () => ({ checkLessonQuality: vi.fn() }));

const [spec] = recordedOutput<{ lessons: object[] }>("lesson-spec").lessons;

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
  it("pulls a lesson made ahead that fails its later check and writes it again with the check required", async () => {
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
    ).resolves.toStrictEqual({ pulled: [failing.id], reviewed: 2 });

    // One check per lesson at the flex tier, against the model that wrote it.
    expect(checkLessonQuality).toHaveBeenCalledTimes(2);

    expect(
      vi
        .mocked(checkLessonQuality)
        .mock.calls.every(
          ([params]) => params.serviceTier === "flex" && params.writerModel === "openai/gpt-6-sol",
        ),
    ).toBe(true);

    expect(start).toHaveBeenCalledExactlyOnceWith(lessonContentWorkflow, [
      { forceReview: true, lessonId: failing.id },
    ]);

    const [pulled, kept] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: failing.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: passing.id } }),
    ]);

    expect(pulled.contentStatus).toBe("failed");
    expect(kept.contentStatus).toBe("completed");
  });

  it("pulls nothing when a review fails to run", async () => {
    const lesson = await publishedLesson(`Antibodies bind antigens ${randomUUID()}`);
    vi.mocked(checkLessonQuality).mockRejectedValue(new Error("Provider unavailable"));

    await expect(laterReviewWorkflow({ lessonIds: [lesson.id] })).resolves.toStrictEqual({
      pulled: [],
      reviewed: 0,
    });

    expect(start).not.toHaveBeenCalled();

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ contentStatus: "completed" });
  });
});
