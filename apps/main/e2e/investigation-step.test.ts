import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

function buildInvestigationContent(uniqueId: string) {
  const explanations = [
    {
      accuracy: "best" as const,
      feedback: `Correct — the API had a memory leak introduced in v2.2 ${uniqueId}`,
      text: `Memory leak in the API service ${uniqueId}`,
    },
    {
      accuracy: "partial" as const,
      feedback: `Close — DB pools were strained, but that was a symptom ${uniqueId}`,
      text: `Database connection pool exhausted ${uniqueId}`,
    },
    {
      accuracy: "wrong" as const,
      feedback: `Network hardware was fine — the issue was in software ${uniqueId}`,
      text: `Network switch failure ${uniqueId}`,
    },
  ];

  return {
    action: {
      actions: [
        {
          finding: `Finding 0: The data shows an unusual pattern ${uniqueId}`,
          label: `Check server logs ${uniqueId}`,
          quality: "critical" as const,
        },
        {
          finding: `Finding 1: Resource usage is abnormally high ${uniqueId}`,
          label: `Monitor resource usage ${uniqueId}`,
          quality: "critical" as const,
        },
        {
          finding: `Finding 2: Errors concentrated on one route ${uniqueId}`,
          label: `Review error distribution ${uniqueId}`,
          quality: "useful" as const,
        },
        {
          finding: `Finding 3: Recent deploy introduced a regression ${uniqueId}`,
          label: `Check deploy history ${uniqueId}`,
          quality: "useful" as const,
        },
        {
          finding: `Finding 4: One query taking 1500ms ${uniqueId}`,
          label: `Run database queries ${uniqueId}`,
          quality: "weak" as const,
        },
      ],
      variant: "action" as const,
    },
    call: {
      explanations,
      variant: "call" as const,
    },
    problem: {
      scenario: `Your team's API has been experiencing intermittent 500 errors since this morning ${uniqueId}`,
      variant: "problem" as const,
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
      content: content.call,
      isPublished: true,
      kind: "investigation",
      position: 2,
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
  test("renders scenario as read-only", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/the case/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`intermittent 500 errors.*${uniqueId}`))).toBeVisible();
  });

  test("check button enabled immediately (read-only step)", async ({ page }) => {
    const { url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /start investigation/i })).toBeEnabled();
  });
});

test.describe("Investigation Action Step", () => {
  test("renders action options after problem", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /start investigation/i }).click();

    await expect(page.getByText(/what do you want to investigate first/i)).toBeVisible();
    await expect(
      page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }),
    ).toBeVisible();
  });

  test("shows evidence feedback after checking action", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /start investigation/i }).click();

    await page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(/strong lead/i)).toBeVisible();
    await expect(
      page.getByText(new RegExp(`Finding 0.*unusual pattern.*${uniqueId}`)),
    ).toBeVisible();
  });
});

test.describe("Investigation Action Loop", () => {
  test("used actions are filtered from subsequent visits", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Problem -> action
    await page.getByRole("button", { name: /start investigation/i }).click();

    // Select and check first action
    await page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();

    // Evidence feedback -> continue to next action
    await page.getByRole("button", { name: /continue/i }).click();

    // First action should be filtered out
    await expect(
      page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }),
    ).not.toBeVisible();

    await expect(
      page.getByRole("radio", { name: new RegExp(`Monitor resource usage ${uniqueId}`) }),
    ).toBeVisible();
  });
});

test.describe("Investigation Scenario Popover", () => {
  test("visible on action step but not on problem step", async ({ page }) => {
    const { url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /context/i })).not.toBeVisible();

    await page.getByRole("button", { name: /start investigation/i }).click();

    await expect(page.getByRole("button", { name: /context/i })).toBeVisible();
  });
});

test.describe("Investigation Call Step", () => {
  test("renders explanations and evidence drawer trigger", async ({ page }) => {
    const { url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /start investigation/i }).click();
    // Experiment 1
    await page.getByRole("radiogroup").getByRole("radio").first().click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Experiment 2
    await page.getByRole("radiogroup").getByRole("radio").first().click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Experiment 3
    await page.getByRole("radiogroup").getByRole("radio").first().click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByText(/what do you think happened/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /review evidence/i })).toBeVisible();
  });

  test("opens evidence drawer with gathered findings", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /start investigation/i }).click();
    // Experiment 1: pick a specific action to get a predictable finding
    await page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Experiment 2
    await page.getByRole("radiogroup").getByRole("radio").first().click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Experiment 3
    await page.getByRole("radiogroup").getByRole("radio").first().click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await page.getByRole("button", { name: /review evidence/i }).click();

    await expect(page.getByRole("heading", { name: /evidence/i })).toBeVisible();
    await expect(page.getByText(new RegExp(`unusual pattern.*${uniqueId}`))).toBeVisible();
  });

  test("selects an explanation via keyboard shortcut", async ({ page }) => {
    const { url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /start investigation/i }).click();
    // Experiment 1
    await page.getByRole("radiogroup").getByRole("radio").first().click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Experiment 2
    await page.getByRole("radiogroup").getByRole("radio").first().click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Experiment 3
    await page.getByRole("radiogroup").getByRole("radio").first().click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Press "1" to select the first explanation via keyboard
    await page.keyboard.press("1");
    const firstRadio = page.getByRole("radiogroup").getByRole("radio").first();
    await expect(firstRadio).toBeChecked();
  });

  test("shows per-explanation feedback on feedback screen after checking call", async ({
    page,
  }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /start investigation/i }).click();
    // Experiment 1
    await page.getByRole("radiogroup").getByRole("radio").first().click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Experiment 2
    await page.getByRole("radiogroup").getByRole("radio").first().click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Experiment 3
    await page.getByRole("radiogroup").getByRole("radio").first().click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await page.getByRole("radio", { name: new RegExp(`Memory leak.*${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();

    const feedbackScreen = page.getByRole("status").filter({ hasText: /memory leak/ });
    await expect(feedbackScreen.getByText(/correct!/i)).toBeVisible();
    await expect(
      feedbackScreen.getByText(new RegExp(`memory leak introduced in v2.2 ${uniqueId}`)),
    ).toBeVisible();
  });
});

test.describe("Full Investigation Flow", () => {
  test("problem -> 3 experiments -> call -> completion shows correct score", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Step 1: Problem - read-only, "Investigate" advances to action
    await expect(page.getByText(/the case/i)).toBeVisible();
    await page.getByRole("button", { name: /start investigation/i }).click();

    // Steps 2-4: Three experiments — pick specific actions by name to avoid flakiness
    // Experiment 1: "Check server logs" (critical = correct)
    await expect(page.getByText(/what do you want to investigate first/i)).toBeVisible();
    await page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Experiment 2: "Monitor resource usage" (critical = correct)
    await expect(page.getByText(/what do you want to investigate next/i)).toBeVisible();
    await page
      .getByRole("radio", { name: new RegExp(`Monitor resource usage ${uniqueId}`) })
      .click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Experiment 3: "Review error distribution" (useful = correct)
    await expect(page.getByText(/one more lead/i)).toBeVisible();
    await page
      .getByRole("radio", { name: new RegExp(`Review error distribution ${uniqueId}`) })
      .click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 5: Call - select best explanation
    await expect(page.getByText(/what do you think happened/i)).toBeVisible();
    await page.getByRole("radio", { name: new RegExp(`Memory leak.*${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();

    // Debrief visible
    await expect(
      page.getByText(new RegExp(`memory leak introduced in v2.2 ${uniqueId}`)),
    ).toBeVisible();

    await page.getByRole("button", { name: /continue/i }).click();

    // Completion screen shows 4/4 (3 correct actions + correct call)
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByText("4/4")).toBeVisible();
  });

  test("mixed action qualities + wrong call shows correct score", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /start investigation/i }).click();

    // Experiment 1: Pick "Check server logs" (critical = correct)
    await expect(page.getByText(/what do you want to investigate first/i)).toBeVisible();
    await page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Experiment 2: Pick "Review error distribution" (useful = correct)
    await expect(page.getByText(/what do you want to investigate next/i)).toBeVisible();
    await page
      .getByRole("radio", { name: new RegExp(`Review error distribution ${uniqueId}`) })
      .click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Experiment 3: Pick "Run database queries" (weak = incorrect)
    await expect(page.getByText(/one more lead/i)).toBeVisible();
    await page.getByRole("radio", { name: new RegExp(`Run database queries ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Call: Pick "Network switch failure" (wrong = incorrect)
    await expect(page.getByText(/what do you think happened/i)).toBeVisible();
    await page
      .getByRole("radio", { name: new RegExp(`Network switch failure ${uniqueId}`) })
      .click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Completion screen shows 2/4 (2 correct actions + 0 correct call)
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByText("2/4")).toBeVisible();
  });
});
