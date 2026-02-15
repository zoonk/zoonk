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

  test("static step with image visual renders the image", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `Image body ${uniqueId}`,
            title: `Image Title ${uniqueId}`,
            variant: "text",
          },
          position: 0,
          visualContent: {
            prompt: `A beautiful sunset ${uniqueId}`,
            url: "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/machine_learning-jmaDwiS0MptNV2EGCZzYWU7RBJs3Qg.webp",
          },
          visualKind: "image",
        },
      ],
    });

    await page.goto(url);

    await expect(async () => {
      await expect(
        page.getByRole("img", { name: new RegExp(`A beautiful sunset ${uniqueId}`) }),
      ).toBeVisible();
    }).toPass();
  });

  test("static step with image visual without URL shows fallback", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `Image fallback body ${uniqueId}`,
            title: `Image Fallback Title ${uniqueId}`,
            variant: "text",
          },
          position: 0,
          visualContent: {
            prompt: `A unique fallback text ${uniqueId}`,
          },
          visualKind: "image",
        },
      ],
    });

    await page.goto(url);

    await expect(page.getByText(new RegExp(`A unique fallback text ${uniqueId}`))).toBeVisible();
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
          visualContent: {
            edges: [{ source: "a", target: "b" }],
            nodes: [
              { id: "a", label: "Start" },
              { id: "b", label: "End" },
            ],
          },
          visualKind: "diagram",
        },
      ],
    });

    await page.goto(url);

    await expect(
      page.getByRole("heading", { name: new RegExp(`Unimplemented Title ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(new RegExp(`Unimplemented body ${uniqueId}`))).toBeVisible();
  });

  test("static step with code visual renders code and language label", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const codeSnippet = `function greet_${uniqueId}() { return "hello"; }`;
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `Code body ${uniqueId}`,
            title: `Code Title ${uniqueId}`,
            variant: "text",
          },
          position: 0,
          visualContent: {
            code: codeSnippet,
            language: "javascript",
          },
          visualKind: "code",
        },
      ],
    });

    await page.goto(url);

    await expect(async () => {
      await expect(page.getByRole("figure", { name: /javascript/i })).toBeVisible();
    }).toPass();

    await expect(page.getByText(new RegExp(`greet_${uniqueId}`))).toBeVisible();
  });

  test("clicking on a code visual does not navigate to the next step", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const codeSnippet = `function stay_${uniqueId}() { return "no nav"; }`;
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `Click code body ${uniqueId}`,
            title: `Click Code Step1 ${uniqueId}`,
            variant: "text",
          },
          position: 0,
          visualContent: {
            code: codeSnippet,
            language: "typescript",
          },
          visualKind: "code",
        },
        {
          content: {
            text: `Next step body ${uniqueId}`,
            title: `Click Code Step2 ${uniqueId}`,
            variant: "text",
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);

    await expect(async () => {
      await expect(page.getByRole("figure", { name: /typescript/i })).toBeVisible();
    }).toPass();

    await expect(page.getByText(/1 \/ 2/)).toBeVisible();

    // Click on the code visual — should NOT navigate
    await page.getByRole("figure", { name: /typescript/i }).click();

    // Still on step 1
    await expect(
      page.getByRole("heading", { name: new RegExp(`Click Code Step1 ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(/1 \/ 2/)).toBeVisible();

    // Keyboard navigation still works
    await page.keyboard.press("ArrowRight");

    await expect(
      page.getByRole("heading", { name: new RegExp(`Click Code Step2 ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(/2 \/ 2/)).toBeVisible();
  });

  test("static step with table visual renders headers and cell data", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `Table body ${uniqueId}`,
            title: `Table Title ${uniqueId}`,
            variant: "text",
          },
          position: 0,
          visualContent: {
            columns: [`Feature ${uniqueId}`, `Python ${uniqueId}`, `JavaScript ${uniqueId}`],
            rows: [
              [`Typing ${uniqueId}`, `Dynamic ${uniqueId}`, `Dynamic ${uniqueId}`],
              [`Paradigm ${uniqueId}`, `Multi ${uniqueId}`, `Multi ${uniqueId}`],
            ],
          },
          visualKind: "table",
        },
      ],
    });

    await page.goto(url);

    await expect(
      page.getByRole("columnheader", { name: new RegExp(`Feature ${uniqueId}`) }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: new RegExp(`Python ${uniqueId}`) }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: new RegExp(`JavaScript ${uniqueId}`) }),
    ).toBeVisible();

    await expect(page.getByRole("cell", { name: new RegExp(`Typing ${uniqueId}`) })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: new RegExp(`Dynamic ${uniqueId}`) }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: new RegExp(`Paradigm ${uniqueId}`) }),
    ).toBeVisible();
  });

  test("static step with table visual renders caption", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const captionText = `Comparison of languages ${uniqueId}`;
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `Table caption body ${uniqueId}`,
            title: `Table Caption Title ${uniqueId}`,
            variant: "text",
          },
          position: 0,
          visualContent: {
            caption: captionText,
            columns: [`Lang ${uniqueId}`, `Year ${uniqueId}`],
            rows: [[`Python ${uniqueId}`, `1991 ${uniqueId}`]],
          },
          visualKind: "table",
        },
      ],
    });

    await page.goto(url);

    await expect(page.getByText(new RegExp(captionText))).toBeVisible();
  });

  test("clicking on a table visual does not navigate to the next step", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `Click table body ${uniqueId}`,
            title: `Click Table Step1 ${uniqueId}`,
            variant: "text",
          },
          position: 0,
          visualContent: {
            caption: `Table caption ${uniqueId}`,
            columns: [`Col A ${uniqueId}`, `Col B ${uniqueId}`],
            rows: [[`Cell 1 ${uniqueId}`, `Cell 2 ${uniqueId}`]],
          },
          visualKind: "table",
        },
        {
          content: {
            text: `Next step body ${uniqueId}`,
            title: `Click Table Step2 ${uniqueId}`,
            variant: "text",
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);

    await expect(
      page.getByRole("columnheader", { name: new RegExp(`Col A ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(/1 \/ 2/)).toBeVisible();

    // Click on the table — should NOT navigate
    await page.getByRole("figure", { name: new RegExp(`Table caption ${uniqueId}`) }).click();

    // Still on step 1
    await expect(
      page.getByRole("heading", { name: new RegExp(`Click Table Step1 ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(/1 \/ 2/)).toBeVisible();

    // Keyboard navigation still works
    await page.keyboard.press("ArrowRight");

    await expect(
      page.getByRole("heading", { name: new RegExp(`Click Table Step2 ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(/2 \/ 2/)).toBeVisible();
  });

  test("static step with timeline visual renders event dates, titles, and descriptions", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `Timeline body ${uniqueId}`,
            title: `Timeline Title ${uniqueId}`,
            variant: "text",
          },
          position: 0,
          visualContent: {
            events: [
              {
                date: `1956 ${uniqueId}`,
                description: `The term AI is coined ${uniqueId}`,
                title: `Dartmouth Conference ${uniqueId}`,
              },
              {
                date: `1997 ${uniqueId}`,
                description: `Deep Blue defeats Kasparov ${uniqueId}`,
                title: `Chess Milestone ${uniqueId}`,
              },
              {
                date: `2012 ${uniqueId}`,
                description: `AlexNet wins ImageNet ${uniqueId}`,
                title: `Deep Learning Breakthrough ${uniqueId}`,
              },
            ],
          },
          visualKind: "timeline",
        },
      ],
    });

    await page.goto(url);

    await expect(page.getByRole("figure", { name: /timeline/i })).toBeVisible();

    await expect(page.getByText(new RegExp(`1956 ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Dartmouth Conference ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`The term AI is coined ${uniqueId}`))).toBeVisible();

    await expect(page.getByText(new RegExp(`1997 ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Chess Milestone ${uniqueId}`))).toBeVisible();
    await expect(
      page.getByText(new RegExp(`Deep Blue defeats Kasparov ${uniqueId}`)),
    ).toBeVisible();

    await expect(page.getByText(new RegExp(`2012 ${uniqueId}`))).toBeVisible();
    await expect(
      page.getByText(new RegExp(`Deep Learning Breakthrough ${uniqueId}`)),
    ).toBeVisible();
    await expect(page.getByText(new RegExp(`AlexNet wins ImageNet ${uniqueId}`))).toBeVisible();
  });

  test("clicking on a timeline visual does not navigate to the next step", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `Click timeline body ${uniqueId}`,
            title: `Click Timeline Step1 ${uniqueId}`,
            variant: "text",
          },
          position: 0,
          visualContent: {
            events: [
              {
                date: `2000 ${uniqueId}`,
                description: `First event description ${uniqueId}`,
                title: `First Event ${uniqueId}`,
              },
              {
                date: `2010 ${uniqueId}`,
                description: `Second event description ${uniqueId}`,
                title: `Second Event ${uniqueId}`,
              },
            ],
          },
          visualKind: "timeline",
        },
        {
          content: {
            text: `Next step body ${uniqueId}`,
            title: `Click Timeline Step2 ${uniqueId}`,
            variant: "text",
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);

    await expect(page.getByRole("figure", { name: /timeline/i })).toBeVisible();
    await expect(page.getByText(/1 \/ 2/)).toBeVisible();

    // Click on the timeline — should NOT navigate
    await page.getByRole("figure", { name: /timeline/i }).click();

    // Still on step 1
    await expect(
      page.getByRole("heading", { name: new RegExp(`Click Timeline Step1 ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(/1 \/ 2/)).toBeVisible();

    // Keyboard navigation still works
    await page.keyboard.press("ArrowRight");

    await expect(
      page.getByRole("heading", { name: new RegExp(`Click Timeline Step2 ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(/2 \/ 2/)).toBeVisible();
  });

  test("static step with code visual renders annotations", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const annotationText = `This declares a variable ${uniqueId}`;
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `Annotated code body ${uniqueId}`,
            title: `Annotated Code Title ${uniqueId}`,
            variant: "text",
          },
          position: 0,
          visualContent: {
            annotations: [{ line: 1, text: annotationText }],
            code: `const x_${uniqueId} = 42;\nconsole.log(x_${uniqueId});`,
            language: "javascript",
          },
          visualKind: "code",
        },
      ],
    });

    await page.goto(url);

    await expect(async () => {
      await expect(page.getByRole("figure", { name: /javascript/i })).toBeVisible();
    }).toPass();

    await expect(page.getByRole("note")).toContainText(annotationText);
  });
});
