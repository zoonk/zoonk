import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

async function createStaticActivityWithVisual(options: {
  steps: {
    content: object;
    position: number;
    visualContent?: object;
    visualKind?: "chart" | "code" | "diagram" | "image" | "quote" | "table" | "timeline";
  }[];
}) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-visual-course-${uniqueId}`,
    title: `E2E Visual Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-visual-chapter-${uniqueId}`,
    title: `E2E Visual Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E visual lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-visual-lesson-${uniqueId}`,
    title: `E2E Visual Lesson ${uniqueId}`,
  });

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E Visual Activity ${uniqueId}`,
  });

  await Promise.all(
    options.steps.map((step) =>
      stepFixture({
        activityId: activity.id,
        content: step.content,
        isPublished: true,
        position: step.position,
        visualContent: step.visualContent,
        visualKind: step.visualKind,
      }),
    ),
  );

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`;

  return { url };
}

test.describe("Step Visual Content", () => {
  test("static step with quote visual renders quote text and author", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `Quote body ${uniqueId}`,
            title: `Quote Title ${uniqueId}`,
            variant: "text",
          },
          position: 0,
          visualContent: {
            author: `Author ${uniqueId}`,
            text: `The only limit is your imagination ${uniqueId}`,
          },
          visualKind: "quote",
        },
      ],
    });

    await page.goto(url);

    await expect(
      page.getByText(new RegExp(`The only limit is your imagination ${uniqueId}`)),
    ).toBeVisible();
    await expect(page.getByText(new RegExp(`Author ${uniqueId}`))).toBeVisible();
    await expect(
      page.getByRole("heading", { name: new RegExp(`Quote Title ${uniqueId}`) }),
    ).toBeVisible();
  });

  test("static step without visual content renders text content normally", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `No visual body ${uniqueId}`,
            title: `No Visual Title ${uniqueId}`,
            variant: "text",
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await expect(
      page.getByRole("heading", { name: new RegExp(`No Visual Title ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(new RegExp(`No visual body ${uniqueId}`))).toBeVisible();
  });

  test("static step with unimplemented visual kind renders text content without crashing", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `Unimplemented body ${uniqueId}`,
            title: `Unimplemented Title ${uniqueId}`,
            variant: "text",
          },
          position: 0,
          visualContent: { code: "console.log('hello')", language: "javascript" },
          visualKind: "code",
        },
      ],
    });

    await page.goto(url);

    await expect(
      page.getByRole("heading", { name: new RegExp(`Unimplemented Title ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(new RegExp(`Unimplemented body ${uniqueId}`))).toBeVisible();
  });
});
