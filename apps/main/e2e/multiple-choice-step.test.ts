import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

async function createMultipleChoiceActivity(options: {
  steps: { content: object; position: number }[];
}) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-mc-course-${uniqueId}`,
    title: `E2E MC Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-mc-chapter-${uniqueId}`,
    title: `E2E MC Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E mc lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-mc-lesson-${uniqueId}`,
    title: `E2E MC Lesson ${uniqueId}`,
  });

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E MC Activity ${uniqueId}`,
  });

  await Promise.all(
    options.steps.map((step) =>
      stepFixture({
        activityId: activity.id,
        content: step.content,
        isPublished: true,
        kind: "multipleChoice",
        position: step.position,
      }),
    ),
  );

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`;

  return { activity, chapter, course, lesson, uniqueId, url };
}

test.describe("Core Variant", () => {
  test("renders question text and all options as radio buttons", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            kind: "core",
            options: [
              { feedback: "Not quite", isCorrect: false, text: `Paris ${uniqueId}` },
              { feedback: "Correct!", isCorrect: true, text: `Berlin ${uniqueId}` },
              { feedback: "Not quite", isCorrect: false, text: `Madrid ${uniqueId}` },
            ],
            question: `Capital of Germany ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await expect(page.getByText(new RegExp(`Capital of Germany ${uniqueId}`))).toBeVisible();

    const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });
    await expect(radiogroup).toBeVisible();

    await expect(
      radiogroup.getByRole("radio", { name: new RegExp(`Paris ${uniqueId}`) }),
    ).toBeVisible();
    await expect(
      radiogroup.getByRole("radio", { name: new RegExp(`Berlin ${uniqueId}`) }),
    ).toBeVisible();
    await expect(
      radiogroup.getByRole("radio", { name: new RegExp(`Madrid ${uniqueId}`) }),
    ).toBeVisible();
  });

  test("correct answer shows inline Correct! feedback with question visible", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            kind: "core",
            options: [
              { feedback: `Wrong answer ${uniqueId}`, isCorrect: false, text: "Option A" },
              { feedback: `Well done ${uniqueId}`, isCorrect: true, text: "Option B" },
            ],
            question: `Test question ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: /option b/i }).click();
    await page.getByRole("button", { name: /check/i }).click();

    // Inline feedback visible
    await expect(page.getByText(/correct!/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Well done ${uniqueId}`))).toBeVisible();

    // Question and options remain visible
    await expect(page.getByText(new RegExp(`Test question ${uniqueId}`))).toBeVisible();
    await expect(page.getByRole("radio", { name: /option a/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /option b/i })).toBeVisible();
  });

  test("incorrect answer shows inline Not quite feedback with question visible", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            kind: "core",
            options: [
              { feedback: `Nope ${uniqueId}`, isCorrect: false, text: "Wrong choice" },
              { feedback: "Good job", isCorrect: true, text: "Right choice" },
            ],
            question: `Test question ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: /wrong choice/i }).click();
    await page.getByRole("button", { name: /check/i }).click();

    // Inline feedback visible
    await expect(page.getByText(/not quite/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Nope ${uniqueId}`))).toBeVisible();

    // Question and options remain visible
    await expect(page.getByText(new RegExp(`Test question ${uniqueId}`))).toBeVisible();
    await expect(page.getByRole("radio", { name: /wrong choice/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /right choice/i })).toBeVisible();
  });

  test("renders without question when omitted", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            kind: "core",
            options: [
              { feedback: "Yes", isCorrect: true, text: `Alpha ${uniqueId}` },
              { feedback: "No", isCorrect: false, text: `Beta ${uniqueId}` },
            ],
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });
    await expect(radiogroup).toBeVisible();
    await expect(
      radiogroup.getByRole("radio", { name: new RegExp(`Alpha ${uniqueId}`) }),
    ).toBeVisible();
    await expect(
      radiogroup.getByRole("radio", { name: new RegExp(`Beta ${uniqueId}`) }),
    ).toBeVisible();
  });

  test("renders context text when provided", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            context: `Some context ${uniqueId}`,
            kind: "core",
            options: [
              { feedback: "Yes", isCorrect: true, text: "Opt 1" },
              { feedback: "No", isCorrect: false, text: "Opt 2" },
            ],
            question: `Core question ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await expect(page.getByText(new RegExp(`Some context ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Core question ${uniqueId}`))).toBeVisible();
  });
});

test.describe("Language Variant", () => {
  test("renders context sentence, romanization, translation, and options with romanization", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            context: `Bonjour ${uniqueId}`,
            contextRomanization: `bon-zhoor ${uniqueId}`,
            contextTranslation: `Hello ${uniqueId}`,
            kind: "language",
            options: [
              {
                feedback: "Correct!",
                isCorrect: true,
                text: `Salut ${uniqueId}`,
                textRomanization: `sa-loo ${uniqueId}`,
              },
              {
                feedback: "Not quite",
                isCorrect: false,
                text: `Au revoir ${uniqueId}`,
                textRomanization: `oh reh-vwar ${uniqueId}`,
              },
            ],
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await expect(page.getByText(/someone says:/i)).toBeVisible();
    await expect(page.getByText(/what do you say\?/i)).toBeVisible();

    await expect(page.getByText(new RegExp(`Bonjour ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`bon-zhoor ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Hello ${uniqueId}`))).toBeVisible();

    const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });
    await expect(radiogroup.getByText(new RegExp(`Salut ${uniqueId}`))).toBeVisible();
    await expect(radiogroup.getByText(new RegExp(`sa-loo ${uniqueId}`))).toBeVisible();
    await expect(radiogroup.getByText(new RegExp(`Au revoir ${uniqueId}`))).toBeVisible();
    await expect(radiogroup.getByText(new RegExp(`oh reh-vwar ${uniqueId}`))).toBeVisible();
  });

  test("omits romanization when null", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            context: `Hola ${uniqueId}`,
            contextRomanization: null,
            contextTranslation: `Hello ${uniqueId}`,
            kind: "language",
            options: [
              {
                feedback: "Yes",
                isCorrect: true,
                text: `Buenos dias ${uniqueId}`,
                textRomanization: null,
              },
              {
                feedback: "No",
                isCorrect: false,
                text: `Adios ${uniqueId}`,
                textRomanization: null,
              },
            ],
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await expect(page.getByText(/someone says:/i)).toBeVisible();
    await expect(page.getByText(/what do you say\?/i)).toBeVisible();

    await expect(page.getByText(new RegExp(`Hola ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Hello ${uniqueId}`))).toBeVisible();
  });
});

test.describe("Challenge Variant", () => {
  test("intro screen shown for challenge activity", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            context: `Fork in road ${uniqueId}`,
            kind: "challenge",
            options: [
              {
                consequence: "Safe path",
                effects: [{ dimension: `Courage ${uniqueId}`, impact: "negative" }],
                text: `Go left ${uniqueId}`,
              },
              {
                consequence: "Brave path",
                effects: [{ dimension: `Courage ${uniqueId}`, impact: "positive" }],
                text: `Go right ${uniqueId}`,
              },
            ],
            question: `Which path ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    // Intro screen content
    await expect(page.getByText(/make choices/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Courage ${uniqueId}`))).toBeVisible();
    await expect(page.getByRole("button", { name: /begin/i })).toBeVisible();

    // Step fraction and progress bar should NOT be visible
    await expect(page.getByText(/1 \/ 1/)).not.toBeVisible();
  });

  test("begin button starts challenge", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            context: `Begin test ${uniqueId}`,
            kind: "challenge",
            options: [
              {
                consequence: "Good",
                effects: [{ dimension: "Courage", impact: "positive" }],
                text: `Option A ${uniqueId}`,
              },
              {
                consequence: "Bad",
                effects: [{ dimension: "Courage", impact: "negative" }],
                text: "Option B",
              },
            ],
            question: `Begin question ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.getByRole("button", { name: /begin/i }).click();

    // First step should now be visible
    await expect(page.getByText(new RegExp(`Begin question ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(/1 \/ 1/)).toBeVisible();
  });

  test("enter key starts challenge from intro", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            context: `Enter test ${uniqueId}`,
            kind: "challenge",
            options: [
              {
                consequence: "Good",
                effects: [{ dimension: "Courage", impact: "positive" }],
                text: `Enter option ${uniqueId}`,
              },
              {
                consequence: "Bad",
                effects: [{ dimension: "Courage", impact: "negative" }],
                text: "Other option",
              },
            ],
            question: `Enter question ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await expect(page.getByText(/make choices/i)).toBeVisible();

    await expect(async () => {
      await page.keyboard.press("Enter");
      await expect(page.getByText(new RegExp(`Enter question ${uniqueId}`))).toBeVisible({
        timeout: 1000,
      });
    }).toPass();
  });

  test("renders context, question, and options after begin", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            context: `You find a fork in the road ${uniqueId}`,
            kind: "challenge",
            options: [
              {
                consequence: "You take the safe path",
                effects: [{ dimension: "Courage", impact: "negative" }],
                text: `Go left ${uniqueId}`,
              },
              {
                consequence: "You brave the unknown",
                effects: [{ dimension: "Courage", impact: "positive" }],
                text: `Go right ${uniqueId}`,
              },
            ],
            question: `Which path do you choose ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.getByRole("button", { name: /begin/i }).click();

    await expect(
      page.getByText(new RegExp(`You find a fork in the road ${uniqueId}`)),
    ).toBeVisible();
    await expect(page.getByText(new RegExp(`Which path do you choose ${uniqueId}`))).toBeVisible();

    const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });
    await expect(
      radiogroup.getByRole("radio", { name: new RegExp(`Go left ${uniqueId}`) }),
    ).toBeVisible();
    await expect(
      radiogroup.getByRole("radio", { name: new RegExp(`Go right ${uniqueId}`) }),
    ).toBeVisible();
  });

  test("selecting option shows Outcome feedback with consequence and dimension inventory", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            context: `Challenge context ${uniqueId}`,
            kind: "challenge",
            options: [
              {
                consequence: `Bold move ${uniqueId}`,
                effects: [
                  { dimension: `Wisdom ${uniqueId}`, impact: "positive" },
                  { dimension: `Courage ${uniqueId}`, impact: "negative" },
                ],
                text: "Choice A",
              },
              {
                consequence: "Cautious approach",
                effects: [{ dimension: `Wisdom ${uniqueId}`, impact: "negative" }],
                text: "Choice B",
              },
            ],
            question: `What do you do ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.getByRole("button", { name: /begin/i }).click();
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: /choice a/i }).click();
    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(/outcome/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Bold move ${uniqueId}`))).toBeVisible();

    const inventory = page.getByRole("list", { name: /dimension inventory/i });
    await expect(inventory).toBeVisible();
    await expect(inventory.getByText(new RegExp(`Wisdom ${uniqueId}`))).toBeVisible();
    await expect(inventory.getByText(new RegExp(`Courage ${uniqueId}`))).toBeVisible();
  });

  test("stats button visible during challenge play", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const dim = `Morale ${uniqueId}`;
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            context: `Stats test ${uniqueId}`,
            kind: "challenge",
            options: [
              {
                consequence: "Good",
                effects: [{ dimension: dim, impact: "positive" }],
                text: `Good choice ${uniqueId}`,
              },
              {
                consequence: "Bad",
                effects: [{ dimension: dim, impact: "negative" }],
                text: "Bad choice",
              },
            ],
            question: `Stats question ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.getByRole("button", { name: /begin/i }).click();

    // Stats button should be visible
    const statsButton = page.getByRole("button", { name: /view stats/i });
    await expect(statsButton).toBeVisible();

    // Click to open popover
    await statsButton.click();

    // Popover should show dimension names
    await expect(page.getByText(new RegExp(dim))).toBeVisible();
  });

  test("stats reflect accumulated changes", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const dim = `Resolve ${uniqueId}`;
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            context: `Step 1 ${uniqueId}`,
            kind: "challenge",
            options: [
              {
                consequence: "Good",
                effects: [{ dimension: dim, impact: "positive" }],
                text: `Positive pick ${uniqueId}`,
              },
              {
                consequence: "Bad",
                effects: [{ dimension: dim, impact: "negative" }],
                text: "Negative pick",
              },
            ],
            question: `Step 1 question ${uniqueId}`,
          },
          position: 0,
        },
        {
          content: {
            context: `Step 2 ${uniqueId}`,
            kind: "challenge",
            options: [
              {
                consequence: "Good again",
                effects: [{ dimension: dim, impact: "positive" }],
                text: `Positive again ${uniqueId}`,
              },
              {
                consequence: "Bad again",
                effects: [{ dimension: dim, impact: "negative" }],
                text: "Negative again",
              },
            ],
            question: `Step 2 question ${uniqueId}`,
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);
    await page.getByRole("button", { name: /begin/i }).click();
    await page.waitForLoadState("networkidle");

    // Step 1: choose positive (+1)
    await page.getByRole("radio", { name: new RegExp(`Positive pick ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Open stats to verify updated total
    await page.getByRole("button", { name: /view stats/i }).click();
    const statsList = page.getByRole("list", { name: /current dimension scores/i });
    await expect(statsList.getByText("1", { exact: true })).toBeVisible();
  });

  test("accumulated inventory across multiple steps", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const dim = `Bravery ${uniqueId}`;
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            context: `Step 1 context ${uniqueId}`,
            kind: "challenge",
            options: [
              {
                consequence: `Gain bravery ${uniqueId}`,
                effects: [{ dimension: dim, impact: "positive" }],
                text: `Brave choice ${uniqueId}`,
              },
              {
                consequence: "Stay safe",
                effects: [{ dimension: dim, impact: "negative" }],
                text: "Safe choice",
              },
            ],
            question: `Step 1 question ${uniqueId}`,
          },
          position: 0,
        },
        {
          content: {
            context: `Step 2 context ${uniqueId}`,
            kind: "challenge",
            options: [
              {
                consequence: `More bravery ${uniqueId}`,
                effects: [{ dimension: dim, impact: "positive" }],
                text: `Bold choice ${uniqueId}`,
              },
              {
                consequence: "Retreat",
                effects: [{ dimension: dim, impact: "negative" }],
                text: "Timid choice",
              },
            ],
            question: `Step 2 question ${uniqueId}`,
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);
    await page.getByRole("button", { name: /begin/i }).click();
    await page.waitForLoadState("networkidle");

    // Step 1: choose brave option (+1)
    await page.getByRole("radio", { name: new RegExp(`Brave choice ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();

    const inventory = page.getByRole("list", { name: /dimension inventory/i });
    await expect(inventory).toBeVisible();
    await expect(inventory.getByText(new RegExp(dim))).toBeVisible();

    // Continue to step 2
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 2: choose bold option (+1 again, total should be 2)
    await page.getByRole("radio", { name: new RegExp(`Bold choice ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();

    // After step 2, total should be 2 (accumulated from both steps)
    await expect(inventory.getByText("2", { exact: true })).toBeVisible();
  });

  test("challenge completion success shows Challenge Complete", async ({ authenticatedPage }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const dim = `Diplomacy ${uniqueId}`;
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            context: `Negotiate ${uniqueId}`,
            kind: "challenge",
            options: [
              {
                consequence: `Peace prevails ${uniqueId}`,
                effects: [{ dimension: dim, impact: "positive" }],
                text: `Negotiate ${uniqueId}`,
              },
              {
                consequence: "War erupts",
                effects: [{ dimension: dim, impact: "negative" }],
                text: "Attack",
              },
            ],
            question: `What do you do ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await authenticatedPage.goto(url);
    await authenticatedPage.getByRole("button", { name: /begin/i }).click();
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage
      .getByRole("radio", { name: new RegExp(`Negotiate ${uniqueId}`) })
      .click();
    await authenticatedPage.getByRole("button", { name: /check/i }).click();
    await authenticatedPage.getByRole("button", { name: /continue/i }).click();

    await expect(authenticatedPage.getByText(/challenge complete/i)).toBeVisible();

    const inventory = authenticatedPage.getByRole("list", { name: /final dimension scores/i });
    await expect(inventory.getByText(new RegExp(dim))).toBeVisible();
  });

  test("challenge completion game over shows Challenge Failed with Try Again", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const dim = `Economy ${uniqueId}`;
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            context: `Crisis ${uniqueId}`,
            kind: "challenge",
            options: [
              {
                consequence: "Good choice",
                effects: [{ dimension: dim, impact: "positive" }],
                text: "Invest",
              },
              {
                consequence: `Economy crashes ${uniqueId}`,
                effects: [{ dimension: dim, impact: "negative" }],
                text: `Spend recklessly ${uniqueId}`,
              },
            ],
            question: `What do you do ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.getByRole("button", { name: /begin/i }).click();
    await page.waitForLoadState("networkidle");

    // Choose the negative option to get a negative dimension
    await page.getByRole("radio", { name: new RegExp(`Spend recklessly ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByText(/challenge failed/i)).toBeVisible();
    await expect(page.getByText(/some of your stats went below zero/i)).toBeVisible();

    const inventory = page.getByRole("list", { name: /final dimension scores/i });
    await expect(inventory.getByText(new RegExp(dim))).toBeVisible();

    // No "Next" button on game over
    await expect(page.getByRole("link", { name: /next/i })).not.toBeVisible();

    // "Try Again" button is available
    const tryAgain = page.getByRole("button", { name: /try again/i });
    await expect(tryAgain).toBeVisible();

    // Click "Try Again" should restart the activity (skips intro)
    await tryAgain.click();

    // After restart, we should see the question again (not intro)
    await expect(page.getByText(new RegExp(`Crisis ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(/make choices/i)).not.toBeVisible();
  });

  test("non-challenge activity skips intro", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            kind: "core",
            options: [
              { feedback: "Yes", isCorrect: true, text: `Core opt ${uniqueId}` },
              { feedback: "No", isCorrect: false, text: "Other opt" },
            ],
            question: `Core question ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    // Should see question immediately, no intro
    await expect(page.getByText(new RegExp(`Core question ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(/make choices/i)).not.toBeVisible();
    await expect(page.getByRole("button", { name: /begin/i })).not.toBeVisible();
  });
});

test.describe("Interaction Mechanics", () => {
  test("Check button disabled until option selected", async ({ page }) => {
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            kind: "core",
            options: [
              { feedback: "Yes", isCorrect: true, text: "Option 1" },
              { feedback: "No", isCorrect: false, text: "Option 2" },
            ],
            question: "Pick one",
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /check/i })).toBeDisabled();

    await page.getByRole("radio", { name: /option 1/i }).click();

    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();
  });

  test("Enter key triggers Check when option is selected", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            kind: "core",
            options: [
              { feedback: `Feedback ${uniqueId}`, isCorrect: true, text: "Answer A" },
              { feedback: "Nope", isCorrect: false, text: "Answer B" },
            ],
            question: `Enter key test ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: /answer a/i }).click();
    await page.keyboard.press("Enter");

    await expect(page.getByText(/correct!/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Feedback ${uniqueId}`))).toBeVisible();
  });

  test("number key shortcuts select corresponding option", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            kind: "core",
            options: [
              { feedback: `Feedback A ${uniqueId}`, isCorrect: false, text: `First ${uniqueId}` },
              { feedback: `Feedback B ${uniqueId}`, isCorrect: true, text: `Second ${uniqueId}` },
            ],
            question: `Shortcut test ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Press 1 to select the first displayed option (position may vary due to shuffle)
    await page.keyboard.press("1");

    // Check button should now be enabled
    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();

    // Verify pressing Enter submits and shows feedback (correct or incorrect)
    await page.keyboard.press("Enter");
    await expect(page.getByText(new RegExp(`Feedback [AB] ${uniqueId}`))).toBeVisible();
  });

  test("changing selection before checking updates the highlighted option", async ({ page }) => {
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            kind: "core",
            options: [
              { feedback: "No", isCorrect: false, text: "First opt" },
              { feedback: "Yes", isCorrect: true, text: "Second opt" },
            ],
            question: "Change test",
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Select first option
    await page.getByRole("radio", { name: /first opt/i }).click();
    await expect(page.getByRole("radio", { name: /first opt/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByRole("radio", { name: /second opt/i })).toHaveAttribute(
      "aria-checked",
      "false",
    );

    // Change to second option
    await page.getByRole("radio", { name: /second opt/i }).click();
    await expect(page.getByRole("radio", { name: /second opt/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByRole("radio", { name: /first opt/i })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  test("options are disabled after checking", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            kind: "core",
            options: [
              { feedback: "Yes", isCorrect: true, text: `Opt A ${uniqueId}` },
              { feedback: "No", isCorrect: false, text: `Opt B ${uniqueId}` },
            ],
            question: `Disable test ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: new RegExp(`Opt A ${uniqueId}`, "i") }).click();
    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(/correct!/i)).toBeVisible();

    // Options should be disabled
    await expect(
      page.getByRole("radio", { name: new RegExp(`Opt A ${uniqueId}`, "i") }),
    ).toBeDisabled();
    await expect(
      page.getByRole("radio", { name: new RegExp(`Opt B ${uniqueId}`, "i") }),
    ).toBeDisabled();
  });

  test("correct option highlighted when user answers incorrectly", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            kind: "core",
            options: [
              { feedback: "Wrong", isCorrect: false, text: `Wrong opt ${uniqueId}` },
              { feedback: "Right", isCorrect: true, text: `Right opt ${uniqueId}` },
            ],
            question: `Highlight test ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Select the wrong option
    await page.getByRole("radio", { name: new RegExp(`Wrong opt ${uniqueId}`, "i") }).click();
    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(/not quite/i)).toBeVisible();

    // Both options should be disabled and visible
    await expect(
      page.getByRole("radio", { name: new RegExp(`Wrong opt ${uniqueId}`, "i") }),
    ).toBeDisabled();
    await expect(
      page.getByRole("radio", { name: new RegExp(`Right opt ${uniqueId}`, "i") }),
    ).toBeDisabled();
  });

  test("challenge variant still shows feedback screen with dimension inventory", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const dim = `Honor ${uniqueId}`;
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            context: `Challenge feedback test ${uniqueId}`,
            kind: "challenge",
            options: [
              {
                consequence: `Honorable ${uniqueId}`,
                effects: [{ dimension: dim, impact: "positive" }],
                text: `Honor pick ${uniqueId}`,
              },
              {
                consequence: "Dishonorable",
                effects: [{ dimension: dim, impact: "negative" }],
                text: "Dishonor pick",
              },
            ],
            question: `Challenge question ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.getByRole("button", { name: /begin/i }).click();
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: new RegExp(`Honor pick ${uniqueId}`, "i") }).click();
    await page.getByRole("button", { name: /check/i }).click();

    // Challenge variant should show Outcome feedback screen (not inline)
    await expect(page.getByText(/outcome/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Honorable ${uniqueId}`))).toBeVisible();

    // Dimension inventory should be visible
    const inventory = page.getByRole("list", { name: /dimension inventory/i });
    await expect(inventory).toBeVisible();
    await expect(inventory.getByText(new RegExp(dim))).toBeVisible();
  });

  test("full flow: select -> check -> continue -> completion screen", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            kind: "core",
            options: [
              { feedback: `Good ${uniqueId}`, isCorrect: true, text: "Right" },
              { feedback: "Bad", isCorrect: false, text: "Wrong" },
            ],
            question: `Full flow test ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Select answer
    await page.getByRole("radio", { name: /right/i }).click();

    // Check - question stays visible with inline feedback
    await page.getByRole("button", { name: /check/i }).click();
    await expect(page.getByText(/correct!/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Full flow test ${uniqueId}`))).toBeVisible();

    // Continue
    await page.getByRole("button", { name: /continue/i }).click();

    // Completion screen
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByText(/1\/1/)).toBeVisible();
  });
});
