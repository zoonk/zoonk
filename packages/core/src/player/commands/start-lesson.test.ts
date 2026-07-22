import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { getSession } from "../../users/get-user-session";
import { startLesson } from "./start-lesson";

vi.mock("../../users/get-user-session", () => ({ getSession: vi.fn() }));

/** Authenticates a unique learner so progress rows stay isolated between tests. */
async function authenticateFixtureUser() {
  const user = await userFixture();
  vi.mocked(getSession).mockResolvedValue({ user } as never);
  return user.id;
}

describe(startLesson, () => {
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;

  beforeAll(async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });
    const chapter = await chapterFixture({ courseId: course.id, organizationId: org.id });
    lesson = await lessonFixture({ chapterId: chapter.id, kind: "quiz", organizationId: org.id });
  });

  it("creates LessonProgress with completedAt null and durationSeconds null", async () => {
    const userId = await authenticateFixtureUser();

    await startLesson(lesson.id);

    const progress = await prisma.lessonProgress.findUnique({
      where: { userLesson: { lessonId: lesson.id, userId } },
    });

    expect(progress).not.toBeNull();
    expect(progress?.completedAt).toBeNull();
    expect(progress?.durationSeconds).toBeNull();
    expect(progress?.startedAt).toBeInstanceOf(Date);
  });

  it("idempotent: second call preserves original startedAt", async () => {
    const userId = await authenticateFixtureUser();

    await startLesson(lesson.id);

    const first = await prisma.lessonProgress.findUnique({
      where: { userLesson: { lessonId: lesson.id, userId } },
    });

    await startLesson(lesson.id);

    const second = await prisma.lessonProgress.findUnique({
      where: { userLesson: { lessonId: lesson.id, userId } },
    });

    expect(second?.startedAt).toStrictEqual(first?.startedAt);
  });

  it("idempotent: concurrent calls create one progress row", async () => {
    const userId = await authenticateFixtureUser();

    await Promise.all([startLesson(lesson.id), startLesson(lesson.id)]);

    const progress = await prisma.lessonProgress.findMany({
      where: { lessonId: lesson.id, userId },
    });

    expect(progress).toHaveLength(1);
    expect(progress[0]?.completedAt).toBeNull();
  });

  it("does not overwrite a completed record", async () => {
    const userId = await authenticateFixtureUser();
    const completedAt = new Date();

    await prisma.lessonProgress.create({
      data: { completedAt, durationSeconds: 30, lessonId: lesson.id, userId },
    });

    await startLesson(lesson.id);

    const progress = await prisma.lessonProgress.findUnique({
      where: { userLesson: { lessonId: lesson.id, userId } },
    });

    expect(progress?.completedAt).toStrictEqual(completedAt);
    expect(progress?.durationSeconds).toBe(30);
  });

  it("does not create progress without an authenticated learner", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const progressCount = await prisma.lessonProgress.count({ where: { lessonId: lesson.id } });

    await startLesson(lesson.id);

    await expect(prisma.lessonProgress.count({ where: { lessonId: lesson.id } })).resolves.toBe(
      progressCount,
    );
  });
});
