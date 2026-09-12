import { CURRENT_CURRICULUM_VERSION } from "@zoonk/core/courses/learning-plan-contract";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

test("a focused course displays and continues in its selected order while the full course retains authored order", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const organization = await getAiOrganization();

  const course = await courseFixture({
    curriculumVersion: CURRENT_CURRICULUM_VERSION,
    isPublished: true,
    organizationId: organization.id,
  });

  const [theory, project, omitted] = await Promise.all(
    ["Understand the background", "Build a useful project", "Explore another topic"].map(
      (title, position) =>
        chapterFixture({
          courseId: course.id,
          isPublished: true,
          level: "basic",
          organizationId: organization.id,
          position,
          title,
        }),
    ),
  );

  const firstLesson = await lessonFixture({
    chapterId: project!.id,
    isPublished: true,
    organizationId: organization.id,
    title: "Make the first useful change",
  });

  await stepFixture({
    content: {
      text: "A small project gives the next concept a concrete purpose.",
      title: "Start with a useful change",
      variant: "text",
    },
    isPublished: true,
    lessonId: firstLesson.id,
  });

  await prisma.courseLearningPlan.create({
    data: {
      chapterIds: [project!.id, theory!.id],
      contentRevision: course.contentRevision,
      courseId: course.id,
      depth: "focused",
      goal: "Build something first, then understand its background",
      userId: noProgressUser.id,
    },
  });

  const href = `/b/ai/c/${course.slug}`;
  await page.goto(href);

  const selectedCards = page.getByRole("link", {
    name: /Understand the background|Build a useful project|Explore another topic/u,
  });

  await expect(selectedCards).toHaveCount(2);
  await expect(selectedCards.nth(0)).toContainText(project!.title);
  await expect(selectedCards.nth(1)).toContainText(theory!.title);

  await expect(page.getByRole("link", { exact: true, name: "Continue" })).toHaveAttribute(
    "href",
    `${href}/ch/${project!.slug}/l/${firstLesson.slug}`,
  );

  await page.getByRole("link", { name: "View full course" }).click();
  await expect(selectedCards).toHaveCount(3);
  await expect(selectedCards.nth(0)).toContainText(theory!.title);
  await expect(selectedCards.nth(1)).toContainText(project!.title);
  await expect(selectedCards.nth(2)).toContainText(omitted!.title);
});
