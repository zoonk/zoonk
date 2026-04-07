import { randomUUID } from "node:crypto";
import { type Locator } from "@playwright/test";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { type Page, expect, test } from "./fixtures";

async function createVisualActivity(options: {
  steps: {
    content: object;
    kind?: "static" | "visual";
    position: number;
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
    kind: "explanation",
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
        kind: step.kind ?? "static",
        position: step.position,
      }),
    ),
  );

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`;

  return { url };
}

function buildWideTable(uniqueId: string) {
  const columns = Array.from({ length: 7 }, (_, index) => `Column ${index + 1} ${uniqueId}`);
  const rows = Array.from({ length: 4 }, (_, rowIndex) =>
    columns.map((column, columnIndex) => `${column} row ${rowIndex + 1} data ${columnIndex + 1}`),
  );

  return {
    caption: `Wide comparison ${uniqueId}`,
    columns,
    kind: "table" as const,
    rows,
  };
}

async function getVisualContentMetrics(page: Page) {
  return page.getByRole("region", { name: /visual content/i }).evaluate((element) => ({
    clientHeight: element.clientHeight,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop,
    scrollWidth: element.scrollWidth,
  }));
}

async function getVisualContentScrollLeft(page: Page) {
  const metrics = await getVisualContentMetrics(page);
  return metrics.scrollLeft;
}

async function getHorizontalScrollMetrics(locator: Locator) {
  return locator.evaluate((element) => {
    let current: HTMLElement | null = element as HTMLElement;

    while (current) {
      const { overflowX } = globalThis.getComputedStyle(current);
      const isScrollable =
        (overflowX === "auto" || overflowX === "scroll") &&
        current.scrollWidth > current.clientWidth;

      if (isScrollable) {
        return {
          clientWidth: current.clientWidth,
          scrollLeft: current.scrollLeft,
          scrollWidth: current.scrollWidth,
        };
      }

      current = current.parentElement;
    }

    throw new Error("Expected a horizontal scroll container");
  });
}

async function getHorizontalScrollLeft(locator: Locator) {
  const metrics = await getHorizontalScrollMetrics(locator);
  return metrics.scrollLeft;
}

async function getVerticalSpacing(container: Locator, item: Locator) {
  const [containerBox, itemBox] = await Promise.all([container.boundingBox(), item.boundingBox()]);

  if (!containerBox || !itemBox) {
    throw new Error("Expected elements to have bounding boxes");
  }

  return {
    bottom: containerBox.y + containerBox.height - (itemBox.y + itemBox.height),
    top: itemBox.y - containerBox.y,
  };
}

async function getViewportTop(locator: ReturnType<Page["getByRole"]>) {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error("Expected element to have a bounding box");
  }

  return box.y;
}

test.describe("Visual Step Content", () => {
  test("visual step renders quote text and author", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
            author: `Author ${uniqueId}`,
            kind: "quote",
            text: `The only limit is your imagination ${uniqueId}`,
          },
          kind: "visual",
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await expect(
      page.getByText(new RegExp(`The only limit is your imagination ${uniqueId}`)),
    ).toBeVisible();
    await expect(page.getByText(new RegExp(`Author ${uniqueId}`))).toBeVisible();
  });

  test("visual step renders an image", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
            kind: "image",
            prompt: `A beautiful sunset ${uniqueId}`,
            url: "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/machine_learning-jmaDwiS0MptNV2EGCZzYWU7RBJs3Qg.webp",
          },
          kind: "visual",
          position: 0,
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

  test("visual step with image without URL shows fallback", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
            kind: "image",
            prompt: `A unique fallback text ${uniqueId}`,
          },
          kind: "visual",
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await expect(page.getByText(new RegExp(`A unique fallback text ${uniqueId}`))).toBeVisible();
  });

  test("static step without visual content renders text content normally", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createVisualActivity({
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

  test("visual step renders diagram nodes and edge labels", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
            edges: [
              { label: `transforms ${uniqueId}`, source: "input", target: "process" },
              { source: "process", target: "output" },
            ],
            kind: "diagram",
            nodes: [
              { id: "input", label: `Input ${uniqueId}` },
              { id: "process", label: `Process ${uniqueId}` },
              { id: "output", label: `Output ${uniqueId}` },
            ],
          },
          kind: "visual",
          position: 0,
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

  test("small diagrams stay centered inside the visual region", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
            edges: [
              { label: `transforms ${uniqueId}`, source: "input", target: "process" },
              { source: "process", target: "output" },
            ],
            kind: "diagram",
            nodes: [
              { id: "input", label: `Input ${uniqueId}` },
              { id: "process", label: `Process ${uniqueId}` },
              { id: "output", label: `Output ${uniqueId}` },
            ],
          },
          kind: "visual",
          position: 0,
        },
      ],
    });

    await page.setViewportSize({ height: 900, width: 1280 });
    await page.goto(url);

    const figure = page.getByRole("figure", { name: /diagram/i });
    const visualContent = page.getByRole("region", { name: /visual content/i });

    await expect(figure).toBeVisible();
    await expect(visualContent).toBeVisible();

    await expect
      .poll(async () => {
        const spacing = await getVerticalSpacing(visualContent, figure);
        return Math.abs(spacing.top - spacing.bottom);
      })
      .toBeLessThan(24);

    const spacing = await getVerticalSpacing(visualContent, figure);

    expect(spacing.top).toBeGreaterThan(40);
    expect(spacing.bottom).toBeGreaterThan(40);
  });

  test("clicking on a visual step with diagram navigates to next step", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
            edges: [{ source: "a", target: "b" }],
            kind: "diagram",
            nodes: [
              { id: "a", label: `Start ${uniqueId}` },
              { id: "b", label: `End ${uniqueId}` },
            ],
          },
          kind: "visual",
          position: 0,
        },
        {
          content: {
            text: `Next step body ${uniqueId}`,
            title: `Diagram Step2 ${uniqueId}`,
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

    await page.waitForLoadState("networkidle");

    await expect(async () => {
      await page.keyboard.press("ArrowRight");
      await expect(
        page.getByRole("heading", { name: new RegExp(`Diagram Step2 ${uniqueId}`) }),
      ).toBeVisible();
    }).toPass();

    await expect(page.getByText(/2 \/ 2/)).toBeVisible();
  });

  test("visual step renders code and language label", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const codeSnippet = `function greet_${uniqueId}() { return "hello"; }`;
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
            code: codeSnippet,
            kind: "code",
            language: "javascript",
          },
          kind: "visual",
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await expect(async () => {
      await expect(page.getByRole("figure", { name: /javascript/i })).toBeVisible();
    }).toPass();

    await expect(page.getByText(new RegExp(`greet_${uniqueId}`))).toBeVisible();
  });

  test("clicking on a visual step with code navigates to next step", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const codeSnippet = `function stay_${uniqueId}() { return "no nav"; }`;
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
            code: codeSnippet,
            kind: "code",
            language: "typescript",
          },
          kind: "visual",
          position: 0,
        },
        {
          content: {
            text: `Next step body ${uniqueId}`,
            title: `Code Step2 ${uniqueId}`,
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

    await page.waitForLoadState("networkidle");

    await expect(async () => {
      await page.keyboard.press("ArrowRight");
      await expect(
        page.getByRole("heading", { name: new RegExp(`Code Step2 ${uniqueId}`) }),
      ).toBeVisible();
    }).toPass();

    await expect(page.getByText(/2 \/ 2/)).toBeVisible();
  });

  test("visual step renders table headers and cell data", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
            columns: [`Feature ${uniqueId}`, `Python ${uniqueId}`, `JavaScript ${uniqueId}`],
            kind: "table",
            rows: [
              [
                `Typing ${uniqueId}`,
                `Dynamic Python ${uniqueId}`,
                `Dynamic JavaScript ${uniqueId}`,
              ],
              [`Paradigm ${uniqueId}`, `Multi ${uniqueId}`, `Multi ${uniqueId}`],
            ],
          },
          kind: "visual",
          position: 0,
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
      page.getByRole("cell", { name: new RegExp(`Dynamic Python ${uniqueId}`) }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: new RegExp(`Paradigm ${uniqueId}`) }),
    ).toBeVisible();
  });

  test("wide tables keep horizontal scroll on the table", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createVisualActivity({
      steps: [
        {
          content: buildWideTable(uniqueId),
          kind: "visual",
          position: 0,
        },
      ],
    });

    await page.setViewportSize({ height: 700, width: 390 });
    await page.goto(url);

    const closeButton = page.getByRole("link", { name: /close/i });
    const nextButton = page.getByRole("button", { name: /next step/i });
    const table = page.getByRole("table");
    const visualContent = page.getByRole("region", { name: /visual content/i });

    await expect(table).toBeVisible();
    await expect(visualContent).toBeVisible();

    const initialTableMetrics = await getHorizontalScrollMetrics(table);

    expect(initialTableMetrics.scrollWidth).toBeGreaterThan(initialTableMetrics.clientWidth);

    const initialWindowScrollY = await page.evaluate(() => window.scrollY);
    const initialCloseTop = await getViewportTop(closeButton);
    const initialNextTop = await getViewportTop(nextButton);

    await table.hover();
    await page.mouse.wheel(500, 0);

    await expect.poll(() => getHorizontalScrollLeft(table)).toBeGreaterThan(0);
    await expect.poll(() => getVisualContentScrollLeft(page)).toBe(0);

    expect(await page.evaluate(() => window.scrollY)).toBe(initialWindowScrollY);
    expect(Math.abs((await getViewportTop(closeButton)) - initialCloseTop)).toBeLessThan(1);
    expect(Math.abs((await getViewportTop(nextButton)) - initialNextTop)).toBeLessThan(1);
  });

  test("visual step renders table caption", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const captionText = `Comparison of languages ${uniqueId}`;
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
            caption: captionText,
            columns: [`Lang ${uniqueId}`, `Year ${uniqueId}`],
            kind: "table",
            rows: [[`Python ${uniqueId}`, `1991 ${uniqueId}`]],
          },
          kind: "visual",
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await expect(page.getByText(new RegExp(captionText))).toBeVisible();
  });

  test("clicking on a visual step with table navigates to next step", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
            caption: `Table caption ${uniqueId}`,
            columns: [`Col A ${uniqueId}`, `Col B ${uniqueId}`],
            kind: "table",
            rows: [[`Cell 1 ${uniqueId}`, `Cell 2 ${uniqueId}`]],
          },
          kind: "visual",
          position: 0,
        },
        {
          content: {
            text: `Next step body ${uniqueId}`,
            title: `Table Step2 ${uniqueId}`,
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

    await page.waitForLoadState("networkidle");

    await expect(async () => {
      await page.keyboard.press("ArrowRight");
      await expect(
        page.getByRole("heading", { name: new RegExp(`Table Step2 ${uniqueId}`) }),
      ).toBeVisible();
    }).toPass();

    await expect(page.getByText(/2 \/ 2/)).toBeVisible();
  });

  test("visual step renders timeline event dates, titles, and descriptions", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
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
            kind: "timeline",
          },
          kind: "visual",
          position: 0,
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

  test("clicking on a visual step with timeline navigates to next step", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
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
            kind: "timeline",
          },
          kind: "visual",
          position: 0,
        },
        {
          content: {
            text: `Next step body ${uniqueId}`,
            title: `Timeline Step2 ${uniqueId}`,
            variant: "text",
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);

    await expect(page.getByRole("figure", { name: /timeline/i })).toBeVisible();
    await expect(page.getByText(/1 \/ 2/)).toBeVisible();

    await page.waitForLoadState("networkidle");

    await expect(async () => {
      await page.keyboard.press("ArrowRight");
      await expect(
        page.getByRole("heading", { name: new RegExp(`Timeline Step2 ${uniqueId}`) }),
      ).toBeVisible();
    }).toPass();

    await expect(page.getByText(/2 \/ 2/)).toBeVisible();
  });

  test("visual step renders bar chart title and category labels", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const chartTitle = `Data Usage ${uniqueId}`;
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
            chartType: "bar",
            data: [
              { name: `Alpha ${uniqueId}`, value: 70 },
              { name: `Beta ${uniqueId}`, value: 45 },
              { name: `Gamma ${uniqueId}`, value: 90 },
            ],
            kind: "chart",
            title: chartTitle,
          },
          kind: "visual",
          position: 0,
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

  test("visual step renders line chart title and category labels", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const chartTitle = `Trend Data ${uniqueId}`;
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
            chartType: "line",
            data: [
              { name: `Jan ${uniqueId}`, value: 10 },
              { name: `Feb ${uniqueId}`, value: 25 },
              { name: `Mar ${uniqueId}`, value: 40 },
            ],
            kind: "chart",
            title: chartTitle,
          },
          kind: "visual",
          position: 0,
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

  test("visual step renders pie chart title and legend", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const chartTitle = `Distribution ${uniqueId}`;
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
            chartType: "pie",
            data: [
              { name: `Red ${uniqueId}`, value: 40 },
              { name: `Blue ${uniqueId}`, value: 35 },
              { name: `Green ${uniqueId}`, value: 25 },
            ],
            kind: "chart",
            title: chartTitle,
          },
          kind: "visual",
          position: 0,
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

  test("clicking on a visual step with chart navigates to next step", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const chartTitle = `Click Chart ${uniqueId}`;
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
            chartType: "bar",
            data: [
              { name: `ItemA ${uniqueId}`, value: 50 },
              { name: `ItemB ${uniqueId}`, value: 30 },
            ],
            kind: "chart",
            title: chartTitle,
          },
          kind: "visual",
          position: 0,
        },
        {
          content: {
            text: `Next step body ${uniqueId}`,
            title: `Chart Step2 ${uniqueId}`,
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

    await page.waitForLoadState("networkidle");

    await expect(async () => {
      await page.keyboard.press("ArrowRight");
      await expect(
        page.getByRole("heading", { name: new RegExp(`Chart Step2 ${uniqueId}`) }),
      ).toBeVisible();
    }).toPass();

    await expect(page.getByText(/2 \/ 2/)).toBeVisible();
  });

  test("visual step renders code annotations", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const annotationText = `This declares a variable ${uniqueId}`;
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
            annotations: [{ line: 1, text: annotationText }],
            code: `const x_${uniqueId} = 42;\nconsole.log(x_${uniqueId});`,
            kind: "code",
            language: "javascript",
          },
          kind: "visual",
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await expect(async () => {
      await expect(page.getByRole("figure", { name: /javascript/i })).toBeVisible();
    }).toPass();

    await expect(page.getByRole("note")).toContainText(annotationText);
  });

  test("visual step renders formula description and math content", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const description = `Pythagorean theorem ${uniqueId}`;
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
            description,
            formula: "a^2 + b^2 = c^2",
            kind: "formula",
          },
          kind: "visual",
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await expect(async () => {
      await expect(page.getByRole("figure", { name: description })).toBeVisible();
    }).toPass();

    await expect(page.getByText(description)).toBeVisible();
  });

  test("clicking on a visual step with formula navigates to next step", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const description = `Formula description ${uniqueId}`;
    const { url } = await createVisualActivity({
      steps: [
        {
          content: {
            description,
            formula: "E = mc^2",
            kind: "formula",
          },
          kind: "visual",
          position: 0,
        },
        {
          content: {
            text: `Next step body ${uniqueId}`,
            title: `Formula Next ${uniqueId}`,
            variant: "text",
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);

    await expect(async () => {
      await expect(page.getByRole("figure", { name: description })).toBeVisible();
    }).toPass();

    await expect(page.getByText(/1 \/ 2/)).toBeVisible();

    await page.waitForLoadState("networkidle");

    await expect(async () => {
      await page.keyboard.press("ArrowRight");
      await expect(
        page.getByRole("heading", { name: new RegExp(`Formula Next ${uniqueId}`) }),
      ).toBeVisible();
    }).toPass();

    await expect(page.getByText(/2 \/ 2/)).toBeVisible();
  });
});
