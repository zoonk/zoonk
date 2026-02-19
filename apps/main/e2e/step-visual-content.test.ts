import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
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
  const org = await getAiOrganization();

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

  test("static step with diagram visual renders nodes and edge labels", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `Diagram body ${uniqueId}`,
            title: `Diagram Title ${uniqueId}`,
            variant: "text",
          },
          position: 0,
          visualContent: {
            edges: [
              { label: `transforms ${uniqueId}`, source: "input", target: "process" },
              { source: "process", target: "output" },
            ],
            nodes: [
              { id: "input", label: `Input ${uniqueId}` },
              { id: "process", label: `Process ${uniqueId}` },
              { id: "output", label: `Output ${uniqueId}` },
            ],
          },
          visualKind: "diagram",
        },
      ],
    });

    await page.goto(url);

    const figure = page.getByRole("figure", { name: /diagram/i });

    await expect(async () => {
      await expect(figure).toBeVisible();
    }).toPass();

    const diagram = figure.getByRole("img");
    await expect(diagram.getByText(`Input ${uniqueId}`)).toBeVisible();
    await expect(diagram.getByText(`Process ${uniqueId}`)).toBeVisible();
    await expect(diagram.getByText(`Output ${uniqueId}`)).toBeVisible();
    await expect(diagram.getByText(`transforms ${uniqueId}`)).toBeVisible();
  });

  test("clicking on a diagram visual does not navigate to the next step", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `Click diagram body ${uniqueId}`,
            title: `Click Diagram Step1 ${uniqueId}`,
            variant: "text",
          },
          position: 0,
          visualContent: {
            edges: [{ source: "a", target: "b" }],
            nodes: [
              { id: "a", label: `Start ${uniqueId}` },
              { id: "b", label: `End ${uniqueId}` },
            ],
          },
          visualKind: "diagram",
        },
        {
          content: {
            text: `Next step body ${uniqueId}`,
            title: `Click Diagram Step2 ${uniqueId}`,
            variant: "text",
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);

    await expect(async () => {
      await expect(page.getByRole("figure", { name: /diagram/i })).toBeVisible();
    }).toPass();

    await expect(page.getByText(/1 \/ 2/)).toBeVisible();

    // Click on the diagram — should NOT navigate
    await page.getByRole("figure", { name: /diagram/i }).click();

    // Still on step 1
    await expect(
      page.getByRole("heading", { name: new RegExp(`Click Diagram Step1 ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(/1 \/ 2/)).toBeVisible();

    // Keyboard navigation still works
    await page.keyboard.press("ArrowRight");

    await expect(
      page.getByRole("heading", { name: new RegExp(`Click Diagram Step2 ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(/2 \/ 2/)).toBeVisible();
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

  test("static step with bar chart visual renders title and category labels", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const chartTitle = `Data Usage ${uniqueId}`;
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `Bar chart body ${uniqueId}`,
            title: `Bar Chart Title ${uniqueId}`,
            variant: "text",
          },
          position: 0,
          visualContent: {
            chartType: "bar",
            data: [
              { name: `Alpha ${uniqueId}`, value: 70 },
              { name: `Beta ${uniqueId}`, value: 45 },
              { name: `Gamma ${uniqueId}`, value: 90 },
            ],
            title: chartTitle,
          },
          visualKind: "chart",
        },
      ],
    });

    await page.goto(url);

    await expect(async () => {
      await expect(page.getByRole("figure", { name: chartTitle })).toBeVisible();
    }).toPass();

    const chart = page.getByRole("figure", { name: chartTitle });
    await expect(chart.getByText(chartTitle)).toBeVisible();
    await expect(chart.getByText(new RegExp(`Alpha ${uniqueId}`))).toBeVisible();
    await expect(chart.getByText(new RegExp(`Beta ${uniqueId}`))).toBeVisible();
    await expect(chart.getByText(new RegExp(`Gamma ${uniqueId}`))).toBeVisible();
  });

  test("static step with line chart visual renders title and category labels", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const chartTitle = `Trend Data ${uniqueId}`;
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `Line chart body ${uniqueId}`,
            title: `Line Chart Title ${uniqueId}`,
            variant: "text",
          },
          position: 0,
          visualContent: {
            chartType: "line",
            data: [
              { name: `Jan ${uniqueId}`, value: 10 },
              { name: `Feb ${uniqueId}`, value: 25 },
              { name: `Mar ${uniqueId}`, value: 40 },
            ],
            title: chartTitle,
          },
          visualKind: "chart",
        },
      ],
    });

    await page.goto(url);

    await expect(async () => {
      await expect(page.getByRole("figure", { name: chartTitle })).toBeVisible();
    }).toPass();

    const chart = page.getByRole("figure", { name: chartTitle });
    await expect(chart.getByText(chartTitle)).toBeVisible();
    await expect(chart.getByText(new RegExp(`Jan ${uniqueId}`))).toBeVisible();
    await expect(chart.getByText(new RegExp(`Feb ${uniqueId}`))).toBeVisible();
    await expect(chart.getByText(new RegExp(`Mar ${uniqueId}`))).toBeVisible();
  });

  test("static step with pie chart visual renders title and legend", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const chartTitle = `Distribution ${uniqueId}`;
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `Pie chart body ${uniqueId}`,
            title: `Pie Chart Title ${uniqueId}`,
            variant: "text",
          },
          position: 0,
          visualContent: {
            chartType: "pie",
            data: [
              { name: `Red ${uniqueId}`, value: 40 },
              { name: `Blue ${uniqueId}`, value: 35 },
              { name: `Green ${uniqueId}`, value: 25 },
            ],
            title: chartTitle,
          },
          visualKind: "chart",
        },
      ],
    });

    await page.goto(url);

    await expect(async () => {
      await expect(page.getByRole("figure", { name: chartTitle })).toBeVisible();
    }).toPass();

    await expect(page.getByText(chartTitle)).toBeVisible();

    const legend = page.getByRole("list", { name: /legend/i });
    await expect(legend.getByText(new RegExp(`Red ${uniqueId}`))).toBeVisible();
    await expect(legend.getByText(new RegExp(`Blue ${uniqueId}`))).toBeVisible();
    await expect(legend.getByText(new RegExp(`Green ${uniqueId}`))).toBeVisible();
  });

  test("clicking on a chart visual does not navigate to the next step", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const chartTitle = `Click Chart ${uniqueId}`;
    const { url } = await createStaticActivityWithVisual({
      steps: [
        {
          content: {
            text: `Click chart body ${uniqueId}`,
            title: `Click Chart Step1 ${uniqueId}`,
            variant: "text",
          },
          position: 0,
          visualContent: {
            chartType: "bar",
            data: [
              { name: `ItemA ${uniqueId}`, value: 50 },
              { name: `ItemB ${uniqueId}`, value: 30 },
            ],
            title: chartTitle,
          },
          visualKind: "chart",
        },
        {
          content: {
            text: `Next step body ${uniqueId}`,
            title: `Click Chart Step2 ${uniqueId}`,
            variant: "text",
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);

    await expect(async () => {
      await expect(page.getByRole("figure", { name: chartTitle })).toBeVisible();
    }).toPass();

    await expect(page.getByText(/1 \/ 2/)).toBeVisible();

    // Click on the chart — should NOT navigate
    await page.getByRole("figure", { name: chartTitle }).click();

    // Still on step 1
    await expect(
      page.getByRole("heading", { name: new RegExp(`Click Chart Step1 ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(/1 \/ 2/)).toBeVisible();

    // Keyboard navigation still works
    await page.keyboard.press("ArrowRight");

    await expect(
      page.getByRole("heading", { name: new RegExp(`Click Chart Step2 ${uniqueId}`) }),
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
