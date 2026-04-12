import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepAttemptFixture } from "@zoonk/testing/fixtures/step-attempts";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { getContentDeleteDecision } from "./lifecycle";

describe("content lifecycle", () => {
  let organizationId: number;

  beforeAll(async () => {
    const organization = await organizationFixture({ kind: "brand" });
    organizationId = organization.id;
  });

  test("returns hardDelete for an unpublished course with no learner data", async () => {
    const course = await courseFixture({ isPublished: false, organizationId });
    const result = await getContentDeleteDecision({ course, entityType: "course" });

    expect(result).toEqual({
      constraints: [],
      mode: "hardDelete",
    });
  });

  test("returns hardDelete even with published descendant curriculum when no learners exist", async () => {
    const course = await courseFixture({ isPublished: false, organizationId });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: false,
      organizationId,
    });

    await lessonFixture({ chapterId: chapter.id, isPublished: true, organizationId });

    const result = await getContentDeleteDecision({ course, entityType: "course" });

    expect(result).toEqual({
      constraints: [],
      mode: "hardDelete",
    });
  });

  test("returns archive for a chapter with descendant learner data", async () => {
    const user = await userFixture();
    const course = await courseFixture({ organizationId });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: false,
      organizationId,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: false,
      organizationId,
    });

    const activity = await activityFixture({
      isPublished: false,
      lessonId: lesson.id,
      organizationId,
    });

    const step = await stepFixture({
      activityId: activity.id,
      isPublished: false,
    });

    await stepAttemptFixture({
      answer: { value: "test" },
      dayOfWeek: 1,
      durationSeconds: 30,
      hourOfDay: 9,
      isCorrect: true,
      stepId: step.id,
      userId: Number(user.id),
    });

    const result = await getContentDeleteDecision({
      chapter,
      entityType: "chapter",
    });

    expect(result).toEqual({
      constraints: ["learnerData"],
      mode: "archive",
    });
  });

  test("returns archive for a lesson with learner-touched activities", async () => {
    const user = await userFixture();
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({ courseId: course.id, organizationId });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: false,
      organizationId,
    });

    const activity = await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId,
    });

    await activityProgressFixture({
      activityId: activity.id,
      completedAt: new Date(),
      durationSeconds: 45,
      userId: Number(user.id),
    });

    const result = await getContentDeleteDecision({
      entityType: "lesson",
      lesson,
    });

    expect(result).toEqual({
      constraints: ["learnerData"],
      mode: "archive",
    });
  });

  test("returns hardDelete for an unpublished activity with no learner data", async () => {
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({ courseId: course.id, organizationId });
    const lesson = await lessonFixture({ chapterId: chapter.id, organizationId });

    const activity = await activityFixture({
      isPublished: false,
      lessonId: lesson.id,
      organizationId,
    });

    const result = await getContentDeleteDecision({
      activity,
      entityType: "activity",
    });

    expect(result).toEqual({
      constraints: [],
      mode: "hardDelete",
    });
  });

  test("returns archive for an unpublished activity with learner data", async () => {
    const user = await userFixture();
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({ courseId: course.id, organizationId });
    const lesson = await lessonFixture({ chapterId: chapter.id, organizationId });

    const activity = await activityFixture({
      isPublished: false,
      lessonId: lesson.id,
      organizationId,
    });

    await activityProgressFixture({
      activityId: activity.id,
      completedAt: new Date(),
      durationSeconds: 30,
      userId: Number(user.id),
    });

    const result = await getContentDeleteDecision({
      activity,
      entityType: "activity",
    });

    expect(result).toEqual({
      constraints: ["learnerData"],
      mode: "archive",
    });
  });

  test("returns archive for a learner-touched activity", async () => {
    const user = await userFixture();
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
    });

    const activity = await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId,
    });

    const step = await stepFixture({
      activityId: activity.id,
      isPublished: true,
    });

    await stepAttemptFixture({
      answer: { value: "answer" },
      dayOfWeek: 3,
      durationSeconds: 22,
      hourOfDay: 13,
      isCorrect: false,
      stepId: step.id,
      userId: Number(user.id),
    });

    const result = await getContentDeleteDecision({
      activity,
      entityType: "activity",
    });

    expect(result).toEqual({
      constraints: ["learnerData"],
      mode: "archive",
    });
  });
});
