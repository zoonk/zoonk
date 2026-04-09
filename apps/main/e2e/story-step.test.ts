import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expectWidthToMatch, getRenderedWidth } from "./_utils/layout-contracts";
import { expect, test } from "./fixtures";

function buildStoryContent(uniqueId: string) {
  return {
    debriefConcepts: [
      {
        content: {
          text: `Training investment builds capacity ${uniqueId}`,
          title: `Resource Allocation ${uniqueId}`,
          variant: "text" as const,
        },
        kind: "static" as const,
      },
    ],
    decisions: [
      {
        content: {
          choices: [
            {
              alignment: "strong" as const,
              consequence: `Production surges ${uniqueId}`,
              id: `choice-1a-${uniqueId}`,
              metricEffects: [
                { effect: "positive" as const, metric: "Production" },
                { effect: "positive" as const, metric: "Morale" },
              ],
              text: `Invest in training ${uniqueId}`,
            },
            {
              alignment: "partial" as const,
              consequence: `Mixed results ${uniqueId}`,
              id: `choice-1b-${uniqueId}`,
              metricEffects: [
                { effect: "neutral" as const, metric: "Production" },
                { effect: "positive" as const, metric: "Morale" },
              ],
              text: `Hire consultants ${uniqueId}`,
            },
            {
              alignment: "weak" as const,
              consequence: `Morale drops ${uniqueId}`,
              id: `choice-1c-${uniqueId}`,
              metricEffects: [
                { effect: "negative" as const, metric: "Production" },
                { effect: "negative" as const, metric: "Morale" },
              ],
              text: `Cut costs ${uniqueId}`,
            },
          ],
          situation: `A crisis hits the factory floor ${uniqueId}`,
        },
        kind: "story" as const,
      },
    ],
    intro: {
      content: {
        intro: `You are a factory manager ${uniqueId}. Your decisions shape the outcome.`,
        metrics: ["Production", "Morale"],
        variant: "storyIntro" as const,
      },
      kind: "static" as const,
    },
    outcome: {
      content: {
        metrics: ["Production", "Morale"],
        outcomes: [
          {
            minStrongChoices: 1,
            narrative: `Excellent leadership ${uniqueId}`,
            title: `Great Manager ${uniqueId}`,
          },
          {
            minStrongChoices: 0,
            narrative: `Room for improvement ${uniqueId}`,
            title: `Average Manager ${uniqueId}`,
          },
        ],
        variant: "storyOutcome" as const,
      },
      kind: "static" as const,
    },
  };
}

async function createStoryActivity() {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);
  const storyContent = buildStoryContent(uniqueId);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-story-course-${uniqueId}`,
    title: `E2E Story Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-story-chapter-${uniqueId}`,
    title: `E2E Story Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E story lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-story-lesson-${uniqueId}`,
    title: `E2E Story Lesson ${uniqueId}`,
  });

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "story",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E Story Activity ${uniqueId}`,
  });

  await Promise.all([
    stepFixture({
      activityId: activity.id,
      content: storyContent.intro.content,
      isPublished: true,
      kind: storyContent.intro.kind,
      position: 0,
    }),
    ...storyContent.decisions.map((decision, index) =>
      stepFixture({
        activityId: activity.id,
        content: decision.content,
        isPublished: true,
        kind: decision.kind,
        position: index + 1,
      }),
    ),
    stepFixture({
      activityId: activity.id,
      content: storyContent.outcome.content,
      isPublished: true,
      kind: storyContent.outcome.kind,
      position: storyContent.decisions.length + 1,
    }),
    ...storyContent.debriefConcepts.map((concept, index) =>
      stepFixture({
        activityId: activity.id,
        content: concept.content,
        isPublished: true,
        kind: concept.kind,
        position: storyContent.decisions.length + 2 + index,
      }),
    ),
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

  return { uniqueId, url };
}

test.describe("Story Intro Screen", () => {
  test("renders intro text and Begin button", async ({ page }) => {
    const { uniqueId, url } = await createStoryActivity();

    await page.goto(url);

    await expect(page.getByText(new RegExp(`You are a factory manager ${uniqueId}`))).toBeVisible();

    await expect(page.getByRole("button", { name: /begin/i })).toBeVisible();

    // Metric labels and starting values visible
    await expect(page.getByText("Production")).toBeVisible();
    await expect(page.getByText("Morale")).toBeVisible();
  });

  test("Begin button advances to first decision step", async ({ page }) => {
    const { uniqueId, url } = await createStoryActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /begin/i }).click();

    await expect(
      page.getByText(new RegExp(`A crisis hits the factory floor ${uniqueId}`)),
    ).toBeVisible();
  });

  test("Enter key advances from intro to decision step", async ({ page }) => {
    const { uniqueId, url } = await createStoryActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("Enter");

    await expect(
      page.getByText(new RegExp(`A crisis hits the factory floor ${uniqueId}`)),
    ).toBeVisible();
  });

  test("reuses the same mobile content width across intro, decision, and outcome", async ({
    page,
  }) => {
    const { uniqueId, url } = await createStoryActivity();

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto(url);
    await page.waitForLoadState("networkidle");

    const beginButton = page.getByRole("button", { name: /begin/i });
    await expect(beginButton).toBeVisible();

    const introActionWidth = await getRenderedWidth({
      description: "story intro action button",
      locator: beginButton,
    });

    await beginButton.click();

    const answerOptions = page.getByRole("radiogroup", { name: /answer options/i });
    await expect(answerOptions).toBeVisible();

    const decisionWidth = await getRenderedWidth({
      description: "story decision options",
      locator: answerOptions,
    });

    await expectWidthToMatch({
      description: "story decision options",
      expectedDescription: "story intro action button",
      expectedWidth: introActionWidth,
      locator: answerOptions,
    });

    await page.getByRole("radio", { name: new RegExp(`Invest in training ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(
      page.getByRole("heading", { name: new RegExp(`Great Manager ${uniqueId}`) }),
    ).toBeVisible();

    await expectWidthToMatch({
      description: "story outcome action button",
      expectedDescription: "story decision options",
      expectedWidth: decisionWidth,
      locator: page.getByRole("button", { name: /continue/i }),
    });
  });
});

test.describe("Story Decision Step", () => {
  test("renders situation text and choice cards", async ({ page }) => {
    const { uniqueId, url } = await createStoryActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Navigate past intro
    await page.getByRole("button", { name: /begin/i }).click();

    // Situation text visible
    await expect(
      page.getByText(new RegExp(`A crisis hits the factory floor ${uniqueId}`)),
    ).toBeVisible();

    // Choice cards visible as radio buttons
    const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });
    await expect(radiogroup).toBeVisible();

    await expect(
      radiogroup.getByRole("radio", { name: new RegExp(`Invest in training ${uniqueId}`) }),
    ).toBeVisible();
    await expect(
      radiogroup.getByRole("radio", { name: new RegExp(`Hire consultants ${uniqueId}`) }),
    ).toBeVisible();
    await expect(
      radiogroup.getByRole("radio", { name: new RegExp(`Cut costs ${uniqueId}`) }),
    ).toBeVisible();
  });

  test("briefing popover shows intro text on decision steps", async ({ page }) => {
    const { uniqueId, url } = await createStoryActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Briefing icon not visible on intro screen (only on decision steps)
    await expect(page.getByRole("button", { name: /context/i })).not.toBeVisible();

    // Navigate to decision step
    await page.getByRole("button", { name: /begin/i }).click();

    // Briefing icon now visible
    const contextButton = page.getByRole("button", { name: /context/i });
    await expect(contextButton).toBeVisible();

    // Click to open popover
    await contextButton.click();

    // Popover shows intro text
    await expect(page.getByText(new RegExp(`You are a factory manager ${uniqueId}`))).toBeVisible();
  });

  test("number key shortcuts select choices", async ({ page }) => {
    const { url } = await createStoryActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /begin/i }).click();
    await page.waitForLoadState("networkidle");

    // Press 1 to select first choice
    await page.keyboard.press("1");

    // Check button should be enabled
    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();
  });

  test("clicking a selected choice unselects it", async ({ page }) => {
    const { uniqueId, url } = await createStoryActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /begin/i }).click();

    const choice = page.getByRole("radio", {
      name: new RegExp(`Invest in training ${uniqueId}`, "i"),
    });

    // Select the choice
    await choice.click();
    await expect(choice).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();

    // Click again to unselect
    await choice.click();
    await expect(choice).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("button", { name: /check/i })).toBeDisabled();
  });
});

test.describe("Story Consequence Feedback", () => {
  test("shows consequence text without correct/incorrect framing", async ({ page }) => {
    const { uniqueId, url } = await createStoryActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Navigate to decision step
    await page.getByRole("button", { name: /begin/i }).click();
    await page.waitForLoadState("networkidle");

    // Select first choice and check
    await page
      .getByRole("radio", { name: new RegExp(`Invest in training ${uniqueId}`, "i") })
      .click();
    await page.getByRole("button", { name: /check/i }).click();

    // Consequence text visible
    await expect(page.getByText(new RegExp(`Production surges ${uniqueId}`))).toBeVisible();

    // No correct/incorrect framing
    await expect(page.getByText(/your answer/i)).not.toBeVisible();
    await expect(page.getByText(/correct answer/i)).not.toBeVisible();
  });
});

test.describe("Story Metrics Bar", () => {
  test("metrics bar visible only on decision and feedback steps", async ({ page }) => {
    const { uniqueId, url } = await createStoryActivity();
    const metricsBar = page.getByRole("status", { name: /current status/i });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Intro: no metrics bar
    await expect(page.getByRole("button", { name: /begin/i })).toBeVisible();
    await expect(metricsBar).not.toBeVisible();

    // Decision step: metrics bar visible
    await page.getByRole("button", { name: /begin/i }).click();
    await expect(metricsBar).toBeVisible();

    // Check answer → feedback: metrics bar still visible
    await page
      .getByRole("radio", { name: new RegExp(`Invest in training ${uniqueId}`, "i") })
      .click();
    await page.getByRole("button", { name: /check/i }).click();
    await expect(metricsBar).toBeVisible();

    // Continue to outcome: no metrics bar
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText(new RegExp(`Great Manager ${uniqueId}`))).toBeVisible();
    await expect(metricsBar).not.toBeVisible();

    // Continue to debrief text step: no metrics bar
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(
      page.getByRole("heading", { name: new RegExp(`Resource Allocation ${uniqueId}`) }),
    ).toBeVisible();
    await expect(metricsBar).not.toBeVisible();
  });
});

test.describe("Full Story Flow", () => {
  test("intro -> decision -> feedback -> outcome -> debrief -> completion", async ({ page }) => {
    const { uniqueId, url } = await createStoryActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Step 1: Intro
    await expect(page.getByText(new RegExp(`You are a factory manager ${uniqueId}`))).toBeVisible();
    await page.getByRole("button", { name: /begin/i }).click();

    // Step 2: Decision
    await expect(
      page.getByText(new RegExp(`A crisis hits the factory floor ${uniqueId}`)),
    ).toBeVisible();

    // Select a choice and check
    await page
      .getByRole("radio", { name: new RegExp(`Invest in training ${uniqueId}`, "i") })
      .click();
    await page.getByRole("button", { name: /check/i }).click();

    // Step 3: Consequence feedback
    await expect(page.getByText(new RegExp(`Production surges ${uniqueId}`))).toBeVisible();

    // Continue to outcome
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 4: Outcome
    await expect(page.getByText(new RegExp(`Great Manager ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Excellent leadership ${uniqueId}`))).toBeVisible();

    // Continue to debrief concept (now a regular text step)
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 5: Debrief concept rendered as text step (title = concept name, body = explanation)
    await expect(
      page.getByRole("heading", { name: new RegExp(`Resource Allocation ${uniqueId}`) }),
    ).toBeVisible();
    await expect(
      page.getByText(new RegExp(`Training investment builds capacity ${uniqueId}`)),
    ).toBeVisible();

    // Navigate past the last step to completion
    await page.keyboard.press("ArrowRight");

    // Step 6: Completion screen
    await expect(page.getByRole("status")).toBeVisible();
  });
});

test.describe("Story Debrief", () => {
  test("debrief concepts render as individual text steps", async ({ page }) => {
    const { uniqueId, url } = await createStoryActivity();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Navigate through story to debrief
    await page.getByRole("button", { name: /begin/i }).click();

    await page
      .getByRole("radio", { name: new RegExp(`Invest in training ${uniqueId}`, "i") })
      .click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Debrief concept shows as regular text step with title and body
    await expect(
      page.getByRole("heading", { name: new RegExp(`Resource Allocation ${uniqueId}`) }),
    ).toBeVisible();
    await expect(
      page.getByText(new RegExp(`Training investment builds capacity ${uniqueId}`)),
    ).toBeVisible();
  });
});
