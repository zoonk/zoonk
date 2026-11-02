import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { mistakeListInputSchema } from "./contract";
import { getMistakePractice } from "./get-mistake-practice";
import { listCurrentUserMistakes } from "./list-current-user-mistakes";

async function targets({ written }: { written: boolean }) {
  const [user, other, skill] = await Promise.all([userFixture(), userFixture(), skillFixture()]);

  const [outline, generating, ready, familiar] = await Promise.all([
    libraryLessonFixture(),
    libraryLessonFixture({ contentStatus: "running" }),
    libraryLessonFixture({ contentStatus: written ? "completed" : "pending" }),
    libraryLessonFixture({ contentStatus: written ? "completed" : "pending" }),
  ]);

  await prisma.lessonSkill.createMany({
    data: [outline, generating, ready, familiar].map((lesson, index) => ({
      createdAt: new Date(Date.UTC(2026, 8, index + 1)),
      lessonId: lesson.id,
      skillId: skill.id,
    })),
  });

  await Promise.all([
    learningEventFixture({ contentIds: { lessonId: outline.id }, userId: other.id }),
    prisma.learningEvent.create({
      data: {
        contentIds: { lessonId: outline.id },
        hour: 12,
        kind: "lesson",
        localDate: new Date("2026-09-01"),
        startedAt: new Date("2026-09-01T12:00:00Z"),
        userId: user.id,
        weekday: 2,
      },
    }),
  ]);

  mockSession(user.id);
  return { familiar, generating, outline, ready, skill, user };
}

async function notebookLesson(mistakeId: string) {
  const result = await listCurrentUserMistakes(mistakeListInputSchema.parse({}));
  expect(result.status).toBe("ready");

  return result.status === "ready"
    ? result.mistakes.find((mistake) => mistake.id === mistakeId)?.lesson
    : undefined;
}

describe("The mistakes notebook's lesson target", () => {
  it("prefers a completed teaching lesson over a written one, without changing drills", async () => {
    const { familiar, outline, skill, user } = await targets({ written: true });
    const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

    await learningEventFixture({
      contentIds: { lessonId: familiar.id },
      kind: "review",
      userId: user.id,
    });

    const mistake = await mistakeFixture({
      cause: "gap",
      createdAt: new Date("2026-09-01"),
      itemId: item.id,
      skillId: skill.id,
      userId: user.id,
    });

    await expect(notebookLesson(mistake.id)).resolves.toStrictEqual({
      id: familiar.id,
      title: familiar.title,
    });

    const drill = await getMistakePractice({ timeZone: "UTC" });
    expect(drill.status === "ready" && drill.practice[0]?.drill.lesson?.id).toBe(outline.id);
  });

  it("otherwise prefers the first written teaching lesson over an outline or running draft", async () => {
    const { ready, skill, user } = await targets({ written: true });
    const mistake = await mistakeFixture({ skillId: skill.id, userId: user.id });

    await expect(notebookLesson(mistake.id)).resolves.toStrictEqual({
      id: ready.id,
      title: ready.title,
    });
  });

  it("falls back to the current first teaching lesson when none is completed or written", async () => {
    const { outline, skill, user } = await targets({ written: false });
    const mistake = await mistakeFixture({ skillId: skill.id, userId: user.id });

    await expect(notebookLesson(mistake.id)).resolves.toStrictEqual({
      id: outline.id,
      title: outline.title,
    });
  });

  it("keeps the lesson where the mistake was made even when another teaching lesson is completed", async () => {
    const { familiar, outline, skill, user } = await targets({ written: true });
    const step = await libraryStepFixture({ lessonId: outline.id, skillId: skill.id });

    await learningEventFixture({ contentIds: { lessonId: familiar.id }, userId: user.id });
    const mistake = await mistakeFixture({ skillId: skill.id, stepId: step.id, userId: user.id });

    await expect(notebookLesson(mistake.id)).resolves.toStrictEqual({
      id: outline.id,
      title: outline.title,
    });
  });

  it("never picks another learner's private lesson even if it is written and was completed", async () => {
    const { familiar, outline, ready, skill, user } = await targets({ written: true });
    const owner = await userFixture();

    await prisma.lesson.updateMany({
      data: { ownerId: owner.id, visibility: "private" },
      where: { id: { in: [ready.id, familiar.id] } },
    });

    await learningEventFixture({ contentIds: { lessonId: familiar.id }, userId: user.id });
    const mistake = await mistakeFixture({ skillId: skill.id, userId: user.id });

    await expect(notebookLesson(mistake.id)).resolves.toStrictEqual({
      id: outline.id,
      title: outline.title,
    });
  });
});
