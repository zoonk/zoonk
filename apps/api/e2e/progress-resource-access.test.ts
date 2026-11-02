import { randomUUID } from "node:crypto";
import { type APIRequestContext, request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  catalogCourseFixture,
  privateCourseFixture,
} from "@zoonk/testing/fixtures/library-courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { createAuthenticatedApiContext } from "./helpers/auth";

const baseURL = process.env.E2E_BASE_URL ?? "";

async function getScopedProgressResponses({
  apiContext,
  resourceId,
  resourceType,
}: {
  apiContext: APIRequestContext;
  resourceId: string;
  resourceType: "chapters" | "courses";
}) {
  return Promise.all([
    apiContext.get(`/v1/${resourceType}/${resourceId}/progress`),
    apiContext.get(`/v1/${resourceType}/${resourceId}/next-lesson`),
  ]);
}

test.describe("Progress resource access", () => {
  test("returns empty progress to visitors for catalog curriculum", async () => {
    const apiContext = await request.newContext({ baseURL });
    const { chapters, course } = await catalogCourseFixture({ lessonCounts: [1] });

    const [[courseProgress], [chapterProgress]] = await Promise.all([
      getScopedProgressResponses({ apiContext, resourceId: course.id, resourceType: "courses" }),
      getScopedProgressResponses({
        apiContext,
        resourceId: chapters[0]!.id,
        resourceType: "chapters",
      }),
    ]);

    expect(courseProgress.status()).toBe(200);
    expect(chapterProgress.status()).toBe(200);
    expect(await courseProgress.json()).toEqual({ chapters: [], percentComplete: null });
    expect(await chapterProgress.json()).toEqual({ lessons: [], percentComplete: null });

    await apiContext.dispose();
  });

  test("serves a private course's progress and next lesson to its owner only", async () => {
    const [owner, other, visitor] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "private-progress-owner" }),
      createAuthenticatedApiContext({ baseURL, prefix: "private-progress-other" }),
      request.newContext({ baseURL }),
    ]);

    const { chapters, course, lessons } = await privateCourseFixture({
      lessonCounts: [2],
      ownerId: owner.user.id,
    });

    const chapter = chapters[0]!;
    const [first, second] = lessons[0]!;

    await learningEventFixture({ contentIds: { lessonId: first!.id }, userId: owner.user.id });

    const readAll = (apiContext: APIRequestContext) =>
      Promise.all([
        getScopedProgressResponses({ apiContext, resourceId: course.id, resourceType: "courses" }),
        getScopedProgressResponses({
          apiContext,
          resourceId: chapter.id,
          resourceType: "chapters",
        }),
      ]).then((pairs) => pairs.flat());

    const [ownerResponses, otherResponses, visitorResponses] = await Promise.all([
      readAll(owner.apiContext),
      readAll(other.apiContext),
      readAll(visitor),
    ]);

    expect(ownerResponses.map((response) => response.status())).toStrictEqual([200, 200, 200, 200]);
    expect(otherResponses.map((response) => response.status())).toStrictEqual([404, 404, 404, 404]);

    expect(visitorResponses.map((response) => response.status())).toStrictEqual([
      404, 404, 404, 404,
    ]);

    const [courseProgress, courseNext, chapterProgress, chapterNext] = await Promise.all(
      ownerResponses.map((response) => response.json()),
    );

    const nextLesson = {
      chapterId: chapter.id,
      courseId: course.id,
      courseSlug: course.slug,
      hasStarted: true,
      lessonId: second!.id,
      lessonPosition: 1,
      organizationSlug: null,
      type: "lesson",
    };

    expect(courseProgress).toEqual({
      chapters: [{ chapterId: chapter.id, completedLessons: 1, totalLessons: 2 }],
      percentComplete: 50,
    });

    expect(chapterProgress).toEqual({
      lessons: [
        { isCompleted: true, lessonId: first!.id },
        { isCompleted: false, lessonId: second!.id },
      ],
      percentComplete: 50,
    });

    expect(courseNext).toMatchObject(nextLesson);
    expect(chapterNext).toMatchObject(nextLesson);

    await Promise.all([owner.apiContext.dispose(), other.apiContext.dispose(), visitor.dispose()]);
  });

  test("returns not found outside the catalog and for other learners' private chapters", async () => {
    const apiContext = await request.newContext({ baseURL });

    const [brand, school, owner] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "school" }),
      userFixture(),
    ]);

    const [unpublishedCourse, schoolCourse, privateChapter] = await Promise.all([
      courseFixture({ isPublished: false, organizationId: brand.id }),
      courseFixture({ isPublished: true, organizationId: school.id }),
      libraryChapterFixture({ ownerId: owner.id, visibility: "private" }),
    ]);

    const scopedResources = [
      { resourceId: randomUUID(), resourceType: "courses" as const },
      { resourceId: unpublishedCourse.id, resourceType: "courses" as const },
      { resourceId: schoolCourse.id, resourceType: "courses" as const },
      { resourceId: randomUUID(), resourceType: "chapters" as const },
      { resourceId: privateChapter.id, resourceType: "chapters" as const },
    ];

    const responsePairs = await Promise.all(
      scopedResources.map(({ resourceId, resourceType }) =>
        getScopedProgressResponses({ apiContext, resourceId, resourceType }),
      ),
    );

    const responses = responsePairs.flat();
    const bodies = await Promise.all(responses.map((response) => response.json()));

    for (const [index, response] of responses.entries()) {
      expect(response.status()).toBe(404);
      expect(bodies[index]).toMatchObject({ error: { code: "NOT_FOUND" } });
    }

    await apiContext.dispose();
  });
});
