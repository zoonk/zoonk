import { randomUUID } from "node:crypto";
import { ErrorCode } from "@/lib/app-error";
import { prisma } from "@zoonk/db";
import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import {
  aiOrganizationFixture,
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { importActivities } from "./import-activities";

function createMockFile(
  content: string,
  name = "activities.json",
  type = "application/json",
): File {
  return new File([content], name, { type });
}

function createImportFile(
  activities: { description?: string; kind: string; title?: string }[],
): File {
  return createMockFile(JSON.stringify({ activities }));
}

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
    const file = createImportFile([{ kind: "explanation", title: "Test" }]);

    const result = await importActivities({
      file,
      headers: new Headers(),
      lessonId: lesson.id,
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

    const [headers, lesson] = await Promise.all([
      signInAs(user.email, user.password),
      lessonFixture({
        chapterId: chapter.id,
        language: course.language,
        organizationId: organization.id,
      }),
    ]);

    const file = createImportFile([{ kind: "explanation", title: "Test" }]);

    const result = await importActivities({
      file,
      headers,
      lessonId: lesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;
    const course = await courseFixture({
      organizationId: fixture.organization.id,
    });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: fixture.organization.id,
    });

    [headers, lesson] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      lessonFixture({
        chapterId: chapter.id,
        language: course.language,
        organizationId: fixture.organization.id,
      }),
    ]);
  });

  test("imports activities successfully", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      language: course.language,
      organizationId: organization.id,
    });

    const file = createImportFile([
      {
        description: "First Description",
        kind: "explanation",
        title: "First Activity",
      },
      {
        description: "Second Description",
        kind: "quiz",
        title: "Second Activity",
      },
    ]);

    const result = await importActivities({
      file,
      headers,
      lessonId: newLesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.data?.[0]?.title).toBe("First Activity");
    expect(result.data?.[0]?.kind).toBe("explanation");
    expect(result.data?.[1]?.title).toBe("Second Activity");
    expect(result.data?.[1]?.kind).toBe("quiz");

    const activities = await prisma.activity.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: newLesson.id },
    });

    expect(activities).toHaveLength(2);
    expect(activities[0]?.id).toBe(result.data?.[0]?.id);
    expect(activities[0]?.position).toBe(0);
    expect(activities[1]?.position).toBe(1);
  });

  test("keeps imported activities ai-managed inside the ai org", async () => {
    const aiOrg = await aiOrganizationFixture();
    const fixture = await memberFixture({ role: "admin" });
    const [_, aiHeaders] = await Promise.all([
      prisma.member.create({
        data: {
          id: randomUUID(),
          organizationId: aiOrg.id,
          role: "admin",
          userId: fixture.user.id,
        },
      }),
      signInAs(fixture.user.email, fixture.user.password),
    ]);
    const aiCourse = await courseFixture({ organizationId: aiOrg.id });
    const aiChapter = await chapterFixture({
      courseId: aiCourse.id,
      language: aiCourse.language,
      organizationId: aiOrg.id,
    });
    const aiLesson = await lessonFixture({
      chapterId: aiChapter.id,
      language: aiCourse.language,
      organizationId: aiOrg.id,
    });
    const file = createImportFile([{ kind: "explanation", title: "Imported" }]);

    const result = await importActivities({
      file,
      headers: aiHeaders,
      lessonId: aiLesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.[0]?.managementMode).toBe("ai");
  });

  test("returns Lesson not found for non-existent lesson", async () => {
    const file = createImportFile([{ kind: "explanation", title: "Test" }]);

    const result = await importActivities({
      file,
      headers,
      lessonId: randomUUID(),
    });

    expect(result.error?.message).toBe(ErrorCode.lessonNotFound);
    expect(result.data).toBeNull();
  });

  test("returns Lesson not found for archived lesson", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const archivedLesson = await lessonFixture({
      archivedAt: new Date(),
      chapterId: chapter.id,
      language: course.language,
      organizationId: organization.id,
    });
    const file = createImportFile([{ kind: "explanation", title: "Test" }]);

    const result = await importActivities({
      file,
      headers,
      lessonId: archivedLesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.lessonNotFound);
    expect(result.data).toBeNull();
  });

  test("don't allow importing activities to a different organization", async () => {
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

    const file = createImportFile([{ kind: "explanation", title: "Test" }]);

    const result = await importActivities({
      file,
      headers,
      lessonId: otherLesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("appends to existing activities", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      language: course.language,
      organizationId: organization.id,
    });

    await activityFixture({
      language: course.language,
      lessonId: newLesson.id,
      organizationId: organization.id,
      position: 0,
      title: "Existing",
    });

    const file = createImportFile([{ kind: "explanation", title: "Imported" }]);

    const result = await importActivities({
      file,
      headers,
      lessonId: newLesson.id,
    });

    expect(result.error).toBeNull();

    const activities = await prisma.activity.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: newLesson.id },
    });

    expect(activities).toHaveLength(2);
    expect(activities[0]?.title).toBe("Existing");
    expect(activities[1]?.title).toBe("Imported");
  });

  test("assigns positions in order", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      language: course.language,
      organizationId: organization.id,
    });

    const file = createImportFile([
      { kind: "explanation", title: "First" },
      { kind: "explanation", title: "Second" },
      { kind: "quiz", title: "Third" },
    ]);

    const result = await importActivities({
      file,
      headers,
      lessonId: newLesson.id,
    });

    expect(result.error).toBeNull();

    const activities = await prisma.activity.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: newLesson.id },
    });

    expect(activities).toHaveLength(3);
    expect(activities[0]?.position).toBe(0);
    expect(activities[0]?.title).toBe("First");
    expect(activities[1]?.position).toBe(1);
    expect(activities[1]?.title).toBe("Second");
    expect(activities[2]?.position).toBe(2);
    expect(activities[2]?.title).toBe("Third");
  });

  describe("replace mode", () => {
    test("removes existing activities and adds new ones", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const chapter = await chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      });
      const newLesson = await lessonFixture({
        chapterId: chapter.id,
        language: course.language,
        organizationId: organization.id,
      });

      await activityFixture({
        language: course.language,
        lessonId: newLesson.id,
        organizationId: organization.id,
        position: 0,
        title: "Existing",
      });

      const file = createImportFile([{ kind: "explanation", title: "New Activity" }]);

      const result = await importActivities({
        file,
        headers,
        lessonId: newLesson.id,
        mode: "replace",
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]?.title).toBe("New Activity");

      const activities = await prisma.activity.findMany({
        where: { lessonId: newLesson.id },
      });

      expect(activities).toHaveLength(1);
      expect(activities[0]?.title).toBe("New Activity");
    });

    test("starts positions from 0 after replace", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const chapter = await chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      });
      const newLesson = await lessonFixture({
        chapterId: chapter.id,
        language: course.language,
        organizationId: organization.id,
      });

      await activityFixture({
        language: course.language,
        lessonId: newLesson.id,
        organizationId: organization.id,
        position: 5,
      });

      const file = createImportFile([
        { kind: "explanation", title: "First" },
        { kind: "quiz", title: "Second" },
      ]);

      const result = await importActivities({
        file,
        headers,
        lessonId: newLesson.id,
        mode: "replace",
      });

      expect(result.error).toBeNull();

      const activities = await prisma.activity.findMany({
        orderBy: { position: "asc" },
        where: { lessonId: newLesson.id },
      });

      expect(activities).toHaveLength(2);
      expect(activities[0]?.position).toBe(0);
      expect(activities[1]?.position).toBe(1);
    });

    test("works with empty lesson", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const chapter = await chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      });
      const newLesson = await lessonFixture({
        chapterId: chapter.id,
        language: course.language,
        organizationId: organization.id,
      });

      const file = createImportFile([{ kind: "explanation", title: "New Activity" }]);

      const result = await importActivities({
        file,
        headers,
        lessonId: newLesson.id,
        mode: "replace",
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
    });

    test("archives learner-touched activities and hard-deletes untouched activities", async () => {
      const user = await userFixture();
      const course = await courseFixture({ organizationId: organization.id });
      const chapter = await chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      });
      const newLesson = await lessonFixture({
        chapterId: chapter.id,
        language: course.language,
        organizationId: organization.id,
      });

      const [touchedActivity, untouchedActivity] = await Promise.all([
        activityFixture({
          language: course.language,
          lessonId: newLesson.id,
          organizationId: organization.id,
          position: 0,
          title: "Touched",
        }),
        activityFixture({
          language: course.language,
          lessonId: newLesson.id,
          organizationId: organization.id,
          position: 1,
          title: "Untouched",
        }),
      ]);

      await activityProgressFixture({
        activityId: touchedActivity.id,
        completedAt: new Date(),
        durationSeconds: 30,
        userId: user.id,
      });

      const file = createImportFile([{ kind: "explanation", title: "New Activity" }]);

      const result = await importActivities({
        file,
        headers,
        lessonId: newLesson.id,
        mode: "replace",
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);

      const [archivedActivity, deletedActivity, activeActivities] = await Promise.all([
        prisma.activity.findUnique({ where: { id: touchedActivity.id } }),
        prisma.activity.findUnique({ where: { id: untouchedActivity.id } }),
        prisma.activity.findMany({
          orderBy: { position: "asc" },
          where: { archivedAt: null, lessonId: newLesson.id },
        }),
      ]);

      expect(archivedActivity?.archivedAt).not.toBeNull();
      expect(deletedActivity).toBeNull();
      expect(activeActivities).toHaveLength(1);
      expect(activeActivities[0]?.title).toBe("New Activity");
      expect(activeActivities[0]?.position).toBe(0);
    });
  });

  test("ignores archived activities when assigning merge positions", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      language: course.language,
      organizationId: organization.id,
    });

    await activityFixture({
      archivedAt: new Date(),
      language: course.language,
      lessonId: newLesson.id,
      organizationId: organization.id,
      position: 6,
      title: "Archived",
    });

    const file = createImportFile([{ kind: "explanation", title: "Imported" }]);

    const result = await importActivities({
      file,
      headers,
      lessonId: newLesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.[0]?.position).toBe(0);
  });

  describe("file validation", () => {
    test("rejects file larger than 5MB", async () => {
      const largeContent = "x".repeat(6 * 1024 * 1024);
      const file = createMockFile(largeContent);

      const result = await importActivities({
        file,
        headers,
        lessonId: lesson.id,
      });

      expect(result.error?.message).toBe(ErrorCode.fileTooLarge);
    });

    test("rejects non-JSON file", async () => {
      const file = new File(["test content"], "activities.txt", {
        type: "text/plain",
      });

      const result = await importActivities({
        file,
        headers,
        lessonId: lesson.id,
      });

      expect(result.error?.message).toBe(ErrorCode.invalidFileType);
    });

    test("rejects invalid JSON", async () => {
      const file = createMockFile("{ invalid json }");

      const result = await importActivities({
        file,
        headers,
        lessonId: lesson.id,
      });

      expect(result.error?.message).toBe(ErrorCode.invalidJsonFormat);
    });

    test("rejects JSON without activities array", async () => {
      const file = createMockFile(JSON.stringify({ foo: "bar" }));

      const result = await importActivities({
        file,
        headers,
        lessonId: lesson.id,
      });

      expect(result.error?.message).toBe(ErrorCode.invalidActivityFormat);
    });

    test("rejects activity without kind", async () => {
      const file = createMockFile(
        JSON.stringify({
          activities: [{ title: "Test" }],
        }),
      );

      const result = await importActivities({
        file,
        headers,
        lessonId: lesson.id,
      });

      expect(result.error?.message).toBe(ErrorCode.invalidActivityFormat);
    });

    test("rejects activity with invalid kind", async () => {
      const file = createMockFile(
        JSON.stringify({
          activities: [{ kind: "invalid_kind" }],
        }),
      );

      const result = await importActivities({
        file,
        headers,
        lessonId: lesson.id,
      });

      expect(result.error?.message).toBe(ErrorCode.invalidActivityFormat);
    });

    test("accepts JSON file by name when type is empty", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const chapter = await chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      });
      const newLesson = await lessonFixture({
        chapterId: chapter.id,
        language: course.language,
        organizationId: organization.id,
      });

      const file = new File(
        [
          JSON.stringify({
            activities: [{ kind: "explanation", title: "Test" }],
          }),
        ],
        "activities.json",
        { type: "" },
      );

      const result = await importActivities({
        file,
        headers,
        lessonId: newLesson.id,
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
    });
  });

  describe("isPublished behavior", () => {
    test("imported activities are published when lesson is unpublished", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const chapter = await chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      });
      const unpublishedLesson = await lessonFixture({
        chapterId: chapter.id,
        isPublished: false,
        language: course.language,
        organizationId: organization.id,
      });

      const file = createImportFile([{ kind: "explanation", title: "Test Activity" }]);

      const result = await importActivities({
        file,
        headers,
        lessonId: unpublishedLesson.id,
      });

      expect(result.error).toBeNull();
      expect(result.data?.[0]?.isPublished).toBe(true);
    });

    test("imported activities are unpublished when lesson is published", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const chapter = await chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      });
      const publishedLesson = await lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        language: course.language,
        organizationId: organization.id,
      });

      const file = createImportFile([{ kind: "explanation", title: "Test Activity" }]);

      const result = await importActivities({
        file,
        headers,
        lessonId: publishedLesson.id,
      });

      expect(result.error).toBeNull();
      expect(result.data?.[0]?.isPublished).toBe(false);
    });
  });

  describe("generationStatus behavior", () => {
    test("sets lesson generationStatus to completed after importing", async () => {
      const course = await courseFixture({ organizationId: organization.id });
      const chapter = await chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      });

      const newLesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        language: course.language,
        organizationId: organization.id,
      });

      const file = createImportFile([{ kind: "explanation", title: "Test Activity" }]);

      const result = await importActivities({
        file,
        headers,
        lessonId: newLesson.id,
      });

      expect(result.error).toBeNull();

      const updatedLesson = await prisma.lesson.findUnique({
        where: { id: newLesson.id },
      });

      expect(updatedLesson?.generationStatus).toBe("completed");
    });
  });
});
