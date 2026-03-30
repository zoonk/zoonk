import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

function makeTradeoffContent(
  uniqueId: string,
  overrides: {
    event?: string | null;
    stateModifiers?: { delta: number; priorityId: string }[] | null;
    tokenOverride?: number | null;
  } = {},
) {
  return {
    event: overrides.event ?? null,
    outcomes: [
      {
        invested: { consequence: `Study invested ${uniqueId}` },
        maintained: { consequence: `Study maintained ${uniqueId}` },
        neglected: { consequence: `Study neglected ${uniqueId}` },
        priorityId: "study",
      },
      {
        invested: { consequence: `Exercise invested ${uniqueId}` },
        maintained: { consequence: `Exercise maintained ${uniqueId}` },
        neglected: { consequence: `Exercise neglected ${uniqueId}` },
        priorityId: "exercise",
      },
      {
        invested: { consequence: `Sleep invested ${uniqueId}` },
        maintained: { consequence: `Sleep maintained ${uniqueId}` },
        neglected: { consequence: `Sleep neglected ${uniqueId}` },
        priorityId: "sleep",
      },
    ],
    priorities: [
      { description: `Study notes ${uniqueId}`, id: "study", name: `Study ${uniqueId}` },
      {
        description: `Physical activity ${uniqueId}`,
        id: "exercise",
        name: `Exercise ${uniqueId}`,
      },
      { description: `Rest and recovery ${uniqueId}`, id: "sleep", name: `Sleep ${uniqueId}` },
    ],
    resource: { name: "hours", total: 5 },
    stateModifiers: overrides.stateModifiers ?? null,
    tokenOverride: overrides.tokenOverride ?? null,
  };
}

async function createTradeoffActivity(options: {
  rounds: {
    event?: string | null;
    stateModifiers?: { delta: number; priorityId: string }[] | null;
    tokenOverride?: number | null;
  }[];
  uniqueId: string;
}) {
  const org = await getAiOrganization();
  const { uniqueId } = options;

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-tf-course-${uniqueId}`,
    title: `E2E TF Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-tf-chapter-${uniqueId}`,
    title: `E2E TF Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E tradeoff lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-tf-lesson-${uniqueId}`,
    title: `E2E TF Lesson ${uniqueId}`,
  });

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "tradeoff",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E TF Activity ${uniqueId}`,
  });

  // Static intro step at position 0
  const introStep = stepFixture({
    activityId: activity.id,
    content: { text: `Scenario text ${uniqueId}`, title: `Scenario ${uniqueId}`, variant: "text" },
    isPublished: true,
    kind: "static",
    position: 0,
  });

  // Tradeoff round steps at positions 1..N
  const roundSteps = options.rounds.map((round, index) =>
    stepFixture({
      activityId: activity.id,
      content: makeTradeoffContent(uniqueId, round),
      isPublished: true,
      kind: "tradeoff",
      position: index + 1,
    }),
  );

  // Static reflection step at position N+1
  const reflectionStep = stepFixture({
    activityId: activity.id,
    content: {
      text: `Reflection text ${uniqueId}`,
      title: `Reflection ${uniqueId}`,
      variant: "text",
    },
    isPublished: true,
    kind: "static",
    position: options.rounds.length + 1,
  });

  // Second activity so the tested one is not the last in the lesson
  const dummyActivity = activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "explanation",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 1,
  });

  await Promise.all([introStep, ...roundSteps, reflectionStep, dummyActivity]);

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`;

  return { activity, url };
}

test.describe("Tradeoff Step", () => {
  test("displays scenario intro, then allocation UI with stepper buttons", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createTradeoffActivity({
      rounds: [{}],
      uniqueId,
    });

    await page.goto(url);

    // Intro static step shows scenario text
    await expect(page.getByText(new RegExp(`Scenario text ${uniqueId}`))).toBeVisible();

    // Navigate to the tradeoff round
    await page.getByRole("button", { name: /next/i }).click();

    // Allocation UI shows priority names
    await expect(page.getByText(new RegExp(`Study ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Exercise ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Sleep ${uniqueId}`))).toBeVisible();

    // Stepper buttons are present
    await expect(
      page.getByRole("button", { name: new RegExp(`Add to Study ${uniqueId}`) }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: new RegExp(`Remove from Study ${uniqueId}`) }),
    ).toBeVisible();

    // Check button is disabled (no tokens allocated yet)
    await expect(page.getByRole("button", { name: /check/i })).toBeDisabled();
  });

  test("enables Check after all tokens are allocated and shows consequences", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createTradeoffActivity({
      rounds: [{}],
      uniqueId,
    });

    await page.goto(url);

    // Skip intro
    await page.getByRole("button", { name: /next/i }).click();

    // Allocate all 5 tokens: 3 to study, 1 to exercise, 1 to sleep
    const addStudy = page.getByRole("button", { name: new RegExp(`Add to Study ${uniqueId}`) });
    const addExercise = page.getByRole("button", {
      name: new RegExp(`Add to Exercise ${uniqueId}`),
    });
    const addSleep = page.getByRole("button", { name: new RegExp(`Add to Sleep ${uniqueId}`) });

    await addStudy.click();
    await addStudy.click();
    await addStudy.click();
    await addExercise.click();
    await addSleep.click();

    // Check button should now be enabled
    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();

    // Click check to see consequences
    await page.getByRole("button", { name: /check/i }).click();

    // Study got 3 tokens (invested), exercise got 1 (maintained), sleep got 1 (maintained)
    await expect(page.getByText(new RegExp(`Study invested ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Exercise maintained ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Sleep maintained ${uniqueId}`))).toBeVisible();
  });

  test("full multi-round flow: allocate → consequences → event → allocate → consequences → reflection → completion", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const eventText = `Exam moved to tomorrow ${uniqueId}`;
    const { url } = await createTradeoffActivity({
      rounds: [
        {},
        {
          event: eventText,
          stateModifiers: [{ delta: -1, priorityId: "sleep" }],
          tokenOverride: 4,
        },
      ],
      uniqueId,
    });

    await page.goto(url);

    // 1. Skip intro
    await page.getByRole("button", { name: /next/i }).click();

    // 2. Round 1: allocate 2-2-1
    const addStudy = page.getByRole("button", { name: new RegExp(`Add to Study ${uniqueId}`) });
    const addExercise = page.getByRole("button", {
      name: new RegExp(`Add to Exercise ${uniqueId}`),
    });
    const addSleep = page.getByRole("button", { name: new RegExp(`Add to Sleep ${uniqueId}`) });

    await addStudy.click();
    await addStudy.click();
    await addExercise.click();
    await addExercise.click();
    await addSleep.click();

    await page.getByRole("button", { name: /check/i }).click();

    // Round 1 consequences visible
    await expect(page.getByText(new RegExp(`Study invested ${uniqueId}`))).toBeVisible();

    // Continue to round 2
    await page.getByRole("button", { name: /continue/i }).click();

    // 3. Round 2: event banner visible
    await expect(page.getByText(new RegExp(eventText))).toBeVisible();

    // Round 2: allocate 2-1-1 (only 4 tokens available due to tokenOverride)
    const addStudy2 = page.getByRole("button", { name: new RegExp(`Add to Study ${uniqueId}`) });
    const addExercise2 = page.getByRole("button", {
      name: new RegExp(`Add to Exercise ${uniqueId}`),
    });
    const addSleep2 = page.getByRole("button", { name: new RegExp(`Add to Sleep ${uniqueId}`) });

    await addStudy2.click();
    await addStudy2.click();
    await addExercise2.click();
    await addSleep2.click();

    await page.getByRole("button", { name: /check/i }).click();

    // Round 2 consequences visible
    await expect(page.getByText(new RegExp(`Study invested ${uniqueId}`))).toBeVisible();

    // Continue to reflection
    await page.getByRole("button", { name: /continue/i }).click();

    // 4. Reflection step
    await expect(page.getByText(new RegExp(`Reflection text ${uniqueId}`))).toBeVisible();

    // Navigate to completion
    await page.getByRole("button", { name: /next/i }).click();

    // 5. Completion screen shows "Completed" (not "X/Y correct")
    await expect(page.getByText(/completed/i)).toBeVisible();
  });

  test("shows neglected consequence when 0 tokens allocated to a priority", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createTradeoffActivity({
      rounds: [{}],
      uniqueId,
    });

    await page.goto(url);
    await page.getByRole("button", { name: /next/i }).click();

    // Allocate all 5 tokens to study, nothing to exercise or sleep
    const addStudy = page.getByRole("button", { name: new RegExp(`Add to Study ${uniqueId}`) });

    await addStudy.click();
    await addStudy.click();
    await addStudy.click();
    await addStudy.click();
    await addStudy.click();

    await page.getByRole("button", { name: /check/i }).click();

    // Exercise and sleep got 0 tokens → neglected
    await expect(page.getByText(new RegExp(`Exercise neglected ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Sleep neglected ${uniqueId}`))).toBeVisible();
  });

  test("stepper minus button is disabled at 0 tokens", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createTradeoffActivity({
      rounds: [{}],
      uniqueId,
    });

    await page.goto(url);
    await page.getByRole("button", { name: /next/i }).click();

    // At 0 tokens, minus should be disabled
    const removeStudy = page.getByRole("button", {
      name: new RegExp(`Remove from Study ${uniqueId}`),
    });
    await expect(removeStudy).toBeDisabled();

    // After adding, minus should be enabled
    const addStudy = page.getByRole("button", { name: new RegExp(`Add to Study ${uniqueId}`) });
    await addStudy.click();
    await expect(removeStudy).toBeEnabled();
  });
});
