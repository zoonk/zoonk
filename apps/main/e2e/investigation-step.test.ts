import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

function buildInvestigationContent(uniqueId: string) {
  const tableVisual = {
    caption: `Server Metrics ${uniqueId}`,
    columns: ["Metric", "Value"],
    kind: "table" as const,
    rows: [
      ["Response Time", "450ms"],
      ["Error Rate", "12%"],
    ],
  };

  const findingVisuals = [
    {
      caption: `Log Analysis ${uniqueId}`,
      columns: ["Time", "Status"],
      kind: "table" as const,
      rows: [
        ["10:00", "OK"],
        ["10:05", "ERROR"],
      ],
    },
    {
      caption: `Resource Usage ${uniqueId}`,
      columns: ["Service", "Load"],
      kind: "table" as const,
      rows: [
        ["API", "95%"],
        ["DB", "40%"],
      ],
    },
    {
      caption: `Error Distribution ${uniqueId}`,
      columns: ["Route", "Errors"],
      kind: "table" as const,
      rows: [
        ["/api/users", "150"],
        ["/api/orders", "0"],
      ],
    },
    {
      caption: `Deploy History ${uniqueId}`,
      columns: ["Version", "Status"],
      kind: "table" as const,
      rows: [
        ["v2.1", "Stable"],
        ["v2.2", "Failing"],
      ],
    },
    {
      caption: `DB Queries ${uniqueId}`,
      columns: ["Query", "Time"],
      kind: "table" as const,
      rows: [
        ["SELECT users", "2ms"],
        ["SELECT orders", "1500ms"],
      ],
    },
  ];

  const explanations = [
    { accuracy: "best" as const, text: `Memory leak in the API service ${uniqueId}` },
    { accuracy: "partial" as const, text: `Database connection pool exhausted ${uniqueId}` },
    { accuracy: "wrong" as const, text: `Network switch failure ${uniqueId}` },
  ];

  function buildInterpretations(findingIndex: number) {
    return explanations.map((_explanation, explanationIndex) => ({
      best: {
        feedback: `Good reading of finding ${findingIndex} for explanation ${explanationIndex} ${uniqueId}`,
        text: `This evidence suggests a pattern consistent with the hypothesis ${findingIndex}-${explanationIndex} ${uniqueId}`,
      },
      dismissive: {
        feedback: `You dismissed relevant evidence ${findingIndex}-${explanationIndex} ${uniqueId}`,
        text: `This doesn't seem relevant to the investigation ${findingIndex}-${explanationIndex} ${uniqueId}`,
      },
      overclaims: {
        feedback: `You read too much into this ${findingIndex}-${explanationIndex} ${uniqueId}`,
        text: `This proves the hypothesis beyond doubt ${findingIndex}-${explanationIndex} ${uniqueId}`,
      },
    }));
  }

  return {
    action: {
      actions: [
        { label: `Check server logs ${uniqueId}`, quality: "critical" as const },
        { label: `Monitor resource usage ${uniqueId}`, quality: "critical" as const },
        { label: `Review error distribution ${uniqueId}`, quality: "useful" as const },
        { label: `Check deploy history ${uniqueId}`, quality: "useful" as const },
        { label: `Run database queries ${uniqueId}`, quality: "weak" as const },
      ],
      variant: "action" as const,
    },
    call: {
      explanations,
      fullExplanation: `The API service had a memory leak introduced in v2.2 ${uniqueId}`,
      variant: "call" as const,
    },
    evidence: {
      findings: findingVisuals.map((visual, index) => ({
        interpretations: buildInterpretations(index),
        text: `Finding ${index}: The data shows an unusual pattern ${uniqueId}`,
        visual,
      })),
      variant: "evidence" as const,
    },
    problem: {
      explanations,
      scenario: `Your team's API has been experiencing intermittent 500 errors since this morning ${uniqueId}`,
      variant: "problem" as const,
      visual: tableVisual,
    },
    score: {
      variant: "investigationScore" as const,
    },
  };
}

async function createInvestigationActivity() {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);
  const content = buildInvestigationContent(uniqueId);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-invest-course-${uniqueId}`,
    title: `E2E Investigation Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-invest-chapter-${uniqueId}`,
    title: `E2E Investigation Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E investigation lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-invest-lesson-${uniqueId}`,
    title: `E2E Investigation Lesson ${uniqueId}`,
  });

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "investigation",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E Investigation Activity ${uniqueId}`,
  });

  await Promise.all([
    stepFixture({
      activityId: activity.id,
      content: content.problem,
      isPublished: true,
      kind: "investigation",
      position: 0,
    }),
    stepFixture({
      activityId: activity.id,
      content: content.action,
      isPublished: true,
      kind: "investigation",
      position: 1,
    }),
    stepFixture({
      activityId: activity.id,
      content: content.evidence,
      isPublished: true,
      kind: "investigation",
      position: 2,
    }),
    stepFixture({
      activityId: activity.id,
      content: content.call,
      isPublished: true,
      kind: "investigation",
      position: 3,
    }),
    stepFixture({
      activityId: activity.id,
      content: content.score,
      isPublished: true,
      kind: "static",
      position: 4,
    }),
    activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 1,
    }),
  ]);

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`;

  return { content, uniqueId, url };
}

test.describe("Investigation Problem Step", () => {
  test("renders scenario, visual preview, and explanation options", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/the case/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`intermittent 500 errors.*${uniqueId}`))).toBeVisible();
    await expect(page.getByRole("button", { name: /view full evidence/i })).toBeVisible();
    await expect(page.getByText(/what's your hunch/i)).toBeVisible();

    const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });
    await expect(radiogroup).toBeVisible();
    await expect(
      radiogroup.getByRole("radio", { name: new RegExp(`Memory leak.*${uniqueId}`) }),
    ).toBeVisible();
    await expect(
      radiogroup.getByRole("radio", { name: new RegExp(`Database connection.*${uniqueId}`) }),
    ).toBeVisible();
    await expect(
      radiogroup.getByRole("radio", { name: new RegExp(`Network switch.*${uniqueId}`) }),
    ).toBeVisible();
  });

  test("opens dialog with full visual when tapping view full", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /view full evidence/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(new RegExp(`Server Metrics ${uniqueId}`))).toBeVisible();
  });

  test("check button disabled until hunch selected", async ({ page }) => {
    const { url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /check/i })).toBeDisabled();

    await page.keyboard.press("1");

    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();
  });
});

test.describe("Investigation Action Step", () => {
  test("renders action options after selecting hunch", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByText(/investigate/i)).toBeVisible();
    await expect(page.getByText(/what do you check/i)).toBeVisible();
    await expect(
      page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }),
    ).toBeVisible();
  });

  test("no 'ready to make your call' button on first visit", async ({ page }) => {
    const { url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByRole("button", { name: /ready to make your call/i })).not.toBeVisible();
  });
});

test.describe("Investigation Evidence Step", () => {
  test("renders finding visual, text, and interpretation options", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }).click();

    // Wait for the evidence step to render after auto-advance
    await expect(page.getByText(/what does this tell you/i)).toBeVisible();

    const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });
    await expect(radiogroup).toBeVisible();
  });

  test("shows inline feedback after checking interpretation", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }).click();

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByRole("region", { name: /answer feedback/i })).toBeVisible();
  });
});

test.describe("Investigation Choice Point", () => {
  test("shows 'ready to make your call' after first experiment", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }).click();

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByRole("button", { name: /ready to make your call/i })).toBeVisible();
  });

  test("used actions are filtered from subsequent visits", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }).click();

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(
      page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }),
    ).not.toBeVisible();

    await expect(
      page.getByRole("radio", { name: new RegExp(`Monitor resource usage ${uniqueId}`) }),
    ).toBeVisible();
  });
});

test.describe("Investigation Hunch Popover", () => {
  test("visible on action step but not on problem step", async ({ page }) => {
    const { url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /your hunch/i })).not.toBeVisible();

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByRole("button", { name: /your hunch/i })).toBeVisible();
  });
});

test.describe("Investigation Call Step", () => {
  test("renders explanations with hunch indicator", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }).click();

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await page.getByRole("button", { name: /ready to make your call/i }).click();

    await expect(page.getByText(/your call/i)).toBeVisible();
    await expect(page.getByText(/what do you think happened/i)).toBeVisible();
    await expect(page.getByText(/your hunch/i)).toBeVisible();
  });

  test("shows debrief after checking call", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }).click();

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await page.getByRole("button", { name: /ready to make your call/i }).click();

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();

    await expect(
      page.getByText(new RegExp(`memory leak introduced in v2.2 ${uniqueId}`)),
    ).toBeVisible();
  });
});

test.describe("Investigation Score Screen", () => {
  test("shows score and dimension blocks", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }).click();

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await page.getByRole("button", { name: /ready to make your call/i }).click();

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByText(/debrief/i)).toBeVisible();
    await expect(page.getByText("/100")).toBeVisible();
  });
});

test.describe("Full Investigation Flow", () => {
  test("problem -> action -> evidence -> make call -> call -> score -> completion", async ({
    page,
  }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Step 1: Problem - select hunch
    await expect(page.getByText(/the case/i)).toBeVisible();
    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 2: Action - select investigation action
    await expect(page.getByText(/investigate/i)).toBeVisible();
    await page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }).click();

    // Step 3: Evidence - select interpretation (wait for auto-advance from action)
    await expect(page.getByText(/what does this tell you/i)).toBeVisible();
    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 4: Action again (choice point) - make call
    await expect(page.getByRole("button", { name: /ready to make your call/i })).toBeVisible();
    await page.getByRole("button", { name: /ready to make your call/i }).click();

    // Step 5: Call - select final answer
    await expect(page.getByText(/your call/i)).toBeVisible();
    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();

    // Debrief visible
    await expect(
      page.getByText(new RegExp(`memory leak introduced in v2.2 ${uniqueId}`)),
    ).toBeVisible();

    await page.getByRole("button", { name: /continue/i }).click();

    // Step 6: Score screen
    await expect(page.getByText(/debrief/i)).toBeVisible();
    await expect(page.getByText("/100")).toBeVisible();

    // Continue past score to completion
    await page.getByRole("button", { name: /continue/i }).click();

    // Completion screen
    await expect(page.getByRole("status")).toBeVisible();
  });
});
