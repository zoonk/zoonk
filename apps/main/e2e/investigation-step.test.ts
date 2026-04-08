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
    { accuracy: "best" as const, text: `Memory leak in the API service ${uniqueId}` },
    { accuracy: "partial" as const, text: `Database connection pool exhausted ${uniqueId}` },
    { accuracy: "wrong" as const, text: `Network switch failure ${uniqueId}` },
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
      fullExplanation: `The API service had a memory leak introduced in v2.2 ${uniqueId}`,
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

    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();
  });
});

test.describe("Investigation Action Step", () => {
  test("renders action options after problem", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(/investigate/i)).toBeVisible();
    await expect(page.getByText(/what do you check/i)).toBeVisible();
    await expect(
      page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }),
    ).toBeVisible();
  });

  test("shows evidence feedback after checking action", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /check/i }).click();

    await page.getByRole("radio", { name: new RegExp(`Check server logs ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(/evidence/i)).toBeVisible();
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
    await page.getByRole("button", { name: /check/i }).click();

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

    await expect(page.getByRole("button", { name: /the case/i })).not.toBeVisible();

    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByRole("button", { name: /the case/i })).toBeVisible();
  });
});

test.describe("Investigation Call Step", () => {
  test("renders explanations and evidence summary", async ({ page }) => {
    const { url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /check/i }).click();
    // Experiment 1
    await page
      .getByRole("radiogroup", { name: /answer options/i })
      .getByRole("radio")
      .first()
      .click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Experiment 2
    await page
      .getByRole("radiogroup", { name: /answer options/i })
      .getByRole("radio")
      .first()
      .click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Experiment 3
    await page
      .getByRole("radiogroup", { name: /answer options/i })
      .getByRole("radio")
      .first()
      .click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByText(/your call/i)).toBeVisible();
    await expect(page.getByText(/what do you think happened/i)).toBeVisible();
    await expect(page.getByText(/your evidence/i)).toBeVisible();
  });

  test("shows debrief after checking call", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /check/i }).click();
    // Experiment 1
    await page
      .getByRole("radiogroup", { name: /answer options/i })
      .getByRole("radio")
      .first()
      .click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Experiment 2
    await page
      .getByRole("radiogroup", { name: /answer options/i })
      .getByRole("radio")
      .first()
      .click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Experiment 3
    await page
      .getByRole("radiogroup", { name: /answer options/i })
      .getByRole("radio")
      .first()
      .click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();

    await expect(
      page.getByText(new RegExp(`memory leak introduced in v2.2 ${uniqueId}`)),
    ).toBeVisible();
  });
});

test.describe("Full Investigation Flow", () => {
  test("problem -> 3 experiments -> call -> completion", async ({ page }) => {
    const { uniqueId, url } = await createInvestigationActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Step 1: Problem - read-only, check advances to action
    await expect(page.getByText(/the case/i)).toBeVisible();
    await page.getByRole("button", { name: /check/i }).click();

    // Steps 2-4: Three experiments (action -> evidence feedback -> continue)
    // Experiment 1
    await page
      .getByRole("radiogroup", { name: /answer options/i })
      .getByRole("radio")
      .first()
      .click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Experiment 2
    await page
      .getByRole("radiogroup", { name: /answer options/i })
      .getByRole("radio")
      .first()
      .click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Experiment 3
    await page
      .getByRole("radiogroup", { name: /answer options/i })
      .getByRole("radio")
      .first()
      .click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 5: Call - select final answer
    await expect(page.getByText(/your call/i)).toBeVisible();
    await page.keyboard.press("1");
    await page.getByRole("button", { name: /check/i }).click();

    // Debrief visible
    await expect(
      page.getByText(new RegExp(`memory leak introduced in v2.2 ${uniqueId}`)),
    ).toBeVisible();

    await page.getByRole("button", { name: /continue/i }).click();

    // Completion screen
    await expect(page.getByRole("status")).toBeVisible();
  });
});
