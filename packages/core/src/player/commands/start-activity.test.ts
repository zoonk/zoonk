import { prisma } from "@zoonk/db";
import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { startActivity } from "./start-activity";

describe(startActivity, () => {
  let activity: Awaited<ReturnType<typeof activityFixture>>;

  beforeAll(async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });
    const chapter = await chapterFixture({ courseId: course.id, organizationId: org.id });
    const lesson = await lessonFixture({ chapterId: chapter.id, organizationId: org.id });

    activity = await activityFixture({
      kind: "quiz",
      lessonId: lesson.id,
      organizationId: org.id,
    });
  });

  test("creates ActivityProgress with completedAt null and durationSeconds null", async () => {
    const user = await userFixture();
    const userId = Number(user.id);

    await startActivity({ activityId: activity.id, userId });

    const progress = await prisma.activityProgress.findUnique({
      where: { userActivity: { activityId: activity.id, userId } },
    });

    expect(progress).not.toBeNull();
    expect(progress?.completedAt).toBeNull();
    expect(progress?.durationSeconds).toBeNull();
    expect(progress?.startedAt).toBeInstanceOf(Date);
  });

  test("idempotent: second call preserves original startedAt", async () => {
    const user = await userFixture();
    const userId = Number(user.id);

    await startActivity({ activityId: activity.id, userId });

    const first = await prisma.activityProgress.findUnique({
      where: { userActivity: { activityId: activity.id, userId } },
    });

    await startActivity({ activityId: activity.id, userId });

    const second = await prisma.activityProgress.findUnique({
      where: { userActivity: { activityId: activity.id, userId } },
    });

    expect(second?.startedAt).toEqual(first?.startedAt);
  });

  test("does not overwrite a completed record", async () => {
    const user = await userFixture();
    const userId = Number(user.id);
    const completedAt = new Date();

    await activityProgressFixture({
      activityId: activity.id,
      completedAt,
      durationSeconds: 30,
      userId,
    });

    await startActivity({ activityId: activity.id, userId });

    const progress = await prisma.activityProgress.findUnique({
      where: { userActivity: { activityId: activity.id, userId } },
    });

    expect(progress?.completedAt).toEqual(completedAt);
    expect(progress?.durationSeconds).toBe(30);
  });
});
