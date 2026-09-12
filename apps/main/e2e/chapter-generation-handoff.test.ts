import { CURRENT_CURRICULUM_VERSION } from "@zoonk/core/courses/learning-plan-contract";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { expect, test } from "./fixtures";
import {
  getGenerationLimitResponse,
  isGenerationEvents,
  isGenerationTrigger,
  routeGenerationApis,
} from "./generation-api";

/** The browser runs real continuation/actions; only the paid workflow boundary is replaced. */
test("chapter creation opens the first visible teaching lesson without funding another chapter", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const organization = await getAiOrganization();

  const course = await courseFixture({
    curriculumVersion: CURRENT_CURRICULUM_VERSION,
    isPublished: true,
    organizationId: organization.id,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    generationStatus: "pending",
    isPublished: true,
    level: "basic",
    organizationId: organization.id,
    position: 0,
  });

  const followingChapter = await chapterFixture({
    courseId: course.id,
    generationStatus: "pending",
    isPublished: true,
    level: "basic",
    organizationId: organization.id,
    position: 1,
  });

  await prisma.courseLearningPlan.create({
    data: {
      chapterIds: [chapter.id, followingChapter.id],
      contentRevision: course.contentRevision,
      courseId: course.id,
      depth: "complete",
      hiddenLessonKinds: ["tutorial"],
      userId: noProgressUser.id,
    },
  });

  let eligibleLessonId: string | undefined;
  const chapterTargets: string[] = [];
  const lessonTargets: string[] = [];

  await routeGenerationApis({
    handler: async (route) => {
      if (isGenerationTrigger({ request: route.request(), targetType: "chapter" })) {
        const body = route.request().postDataJSON();
        chapterTargets.push(body.target.id);
        expect(body.target.id).toBe(chapter.id);

        await lessonFixture({
          chapterId: chapter.id,
          generationStatus: "pending",
          isPublished: true,
          kind: "tutorial",
          organizationId: organization.id,
          position: 0,
          title: "Hidden tutorial",
        });

        const eligible = await lessonFixture({
          chapterId: chapter.id,
          generationStatus: "pending",
          isPublished: true,
          kind: "explanation",
          organizationId: organization.id,
          position: 1,
          title: "First selected explanation",
        });

        eligibleLessonId = eligible.id;

        await prisma.chapter.update({
          data: { generationStatus: "completed" },
          where: { id: chapter.id },
        });

        await route.fulfill({
          json: { id: "chapter-handoff-run", status: "pending" },
          status: 202,
        });

        return;
      }

      if (isGenerationTrigger({ request: route.request(), targetType: "lesson" })) {
        lessonTargets.push(route.request().postDataJSON().target.id);

        const limit = getGenerationLimitResponse({
          period: "month",
          resource: "chapter",
          viewer: "authenticated",
        });

        await route.fulfill({ json: limit.body, status: limit.status });
        return;
      }

      if (isGenerationEvents(route.request().url())) {
        await route.fulfill({
          body: 'data: {"step":"setChapterAsCompleted","status":"completed"}\n\n',
          contentType: "text/event-stream",
          status: 200,
        });

        return;
      }

      await route.fulfill({ json: { status: "completed" }, status: 200 });
    },
    page,
  });

  await page.goto(`/generate/ch/${chapter.id}`);
  await expect.poll(() => lessonTargets.length).toBe(1);
  expect(lessonTargets).toEqual([eligibleLessonId]);
  await expect(page).toHaveURL(`/generate/l/${eligibleLessonId}`);
  expect(chapterTargets).toEqual([chapter.id]);
  expect(await prisma.lesson.count({ where: { chapterId: followingChapter.id } })).toBe(0);

  expect(
    await prisma.chapterGenerationGrant.count({ where: { chapterId: followingChapter.id } }),
  ).toBe(0);
});
