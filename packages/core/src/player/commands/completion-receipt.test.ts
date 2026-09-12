import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { replaceCourseCurriculum } from "../../workflows/internal/course-curriculum";
import { type CompletionInput } from "../contracts/completion-input-schema";
import { completeLesson } from "./create-lesson-completion";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

async function setupAttempt() {
  const user = await userFixture();
  const organization = await organizationFixture({ kind: "brand" });

  const course = await courseFixture({
    format: "question",
    isPublished: true,
    organizationId: organization.id,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: organization.id,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    generationStatus: "completed",
    isPublished: true,
    kind: "quiz",
    organizationId: organization.id,
  });

  const step = await stepFixture({
    content: {
      options: [
        { feedback: "Correct", id: "a", isCorrect: true, text: "A" },
        { feedback: "Try again", id: "b", isCorrect: false, text: "B" },
      ],
    },
    isPublished: true,
    kind: "multipleChoice",
    lessonId: lesson.id,
  });

  const startedAt = Date.now() - 10_000;

  const input: CompletionInput = {
    answers: { [step.id]: { kind: "multipleChoice", selectedOptionId: "a" } },
    lessonId: lesson.id,
    startedAt,
    stepTimings: {
      [step.id]: { answeredAt: startedAt + 5000, dayOfWeek: 1, durationSeconds: 5, hourOfDay: 12 },
    },
    timeZone: "UTC",
  };

  mockSession(user.id);
  return { course, input, lesson, step, user };
}

async function snapshot(userId: string) {
  return {
    attempts: await prisma.stepAttempt.count({ where: { userId } }),
    daily: await prisma.dailyProgress.findMany({ where: { userId } }),
    progress: await prisma.userProgress.findUniqueOrThrow({ where: { userId } }),
    receipts: await prisma.lessonCompletionReceipt.count({ where: { userId } }),
  };
}

describe("completion receipts", () => {
  it("replays concurrent identical requests without awarding duplicate attempts or rewards", async () => {
    const { input, user } = await setupAttempt();
    const results = await Promise.all(Array.from({ length: 5 }, () => completeLesson(input)));
    expect(results.every((result) => result.status === "completed")).toBe(true);
    expect(results).toStrictEqual(Array.from({ length: 5 }, () => results[0]));
    const saved = await snapshot(user.id);
    expect(saved.attempts).toBe(1);
    expect(saved.receipts).toBe(1);
    expect(saved.daily[0]?.interactiveCompleted).toBe(1);
    await expect(completeLesson(input)).resolves.toStrictEqual(results[0]);
    await expect(snapshot(user.id)).resolves.toStrictEqual(saved);
  });

  it("counts a later deliberate practice attempt separately", async () => {
    const { input, user } = await setupAttempt();
    await completeLesson(input);
    await completeLesson({ ...input, startedAt: input.startedAt + 1 });
    const saved = await snapshot(user.id);
    expect(saved.attempts).toBe(2);
    expect(saved.receipts).toBe(2);
    expect(saved.daily[0]?.interactiveCompleted).toBe(2);
  });

  it("replays the saved outcome after curriculum replacement and keeps the receipt owner-private", async () => {
    const { course, input, user } = await setupAttempt();
    const result = await completeLesson(input);
    const before = await snapshot(user.id);

    await replaceCourseCurriculum({
      chapters: [
        {
          description: "An updated explanation",
          key: "updated",
          level: null,
          outcomes: ["Explain the answer"],
          title: "The answer",
        },
      ],
      context: { contentRevision: course.contentRevision, courseId: course.id },
      curriculumVersion: 2,
    });

    await expect(completeLesson(input)).resolves.toStrictEqual(result);
    await expect(snapshot(user.id)).resolves.toStrictEqual(before);
    const stranger = await userFixture();
    mockSession(stranger.id);
    await expect(completeLesson(input)).resolves.toStrictEqual({ status: "notFound" });
  });
});
