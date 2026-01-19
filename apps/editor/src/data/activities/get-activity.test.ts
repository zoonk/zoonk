import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { getActivity } from "./get-activity";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      language: course.language,
      organizationId: organization.id,
    });
    const activity = await activityFixture({
      language: course.language,
      lessonId: lesson.id,
      organizationId: organization.id,
    });

    const result = await getActivity({
      activityId: activity.id,
      headers: new Headers(),
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      language: course.language,
      organizationId: organization.id,
    });

    const [headers, activity] = await Promise.all([
      signInAs(user.email, user.password),
      activityFixture({
        language: course.language,
        lessonId: lesson.id,
        organizationId: organization.id,
      }),
    ]);

    const result = await getActivity({
      activityId: activity.id,
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;

    headers = await signInAs(fixture.user.email, fixture.user.password);
  });

  test("returns activity by id", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      language: course.language,
      organizationId: organization.id,
    });
    const activity = await activityFixture({
      language: course.language,
      lessonId: lesson.id,
      organizationId: organization.id,
      title: "Test Activity",
    });

    const result = await getActivity({
      activityId: activity.id,
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(activity.id);
    expect(result.data?.title).toBe("Test Activity");
  });

  test("returns null when activity not found", async () => {
    const result = await getActivity({
      activityId: BigInt(999_999_999),
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns Forbidden for activity in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });
    const otherLesson = await lessonFixture({
      chapterId: otherChapter.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });
    const otherActivity = await activityFixture({
      language: otherCourse.language,
      lessonId: otherLesson.id,
      organizationId: otherOrg.id,
    });

    const result = await getActivity({
      activityId: otherActivity.id,
      headers,
      orgSlug: otherOrg.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});
