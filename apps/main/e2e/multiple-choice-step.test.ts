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

  test("correct answer shows Correct! feedback", async ({ page }) => {
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

    await expect(page.getByText(/correct!/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Well done ${uniqueId}`))).toBeVisible();
  });

  test("incorrect answer shows Not quite feedback", async ({ page }) => {
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

    await expect(page.getByText(/not quite/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Nope ${uniqueId}`))).toBeVisible();
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

    await expect(page.getByText(new RegExp(`Hola ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Hello ${uniqueId}`))).toBeVisible();

    // No italic romanization elements should be present
    const italicElements = page.locator("p.italic");
    await expect(italicElements).toHaveCount(0);
  });
});

test.describe("Challenge Variant", () => {
  test("renders context, question, and options", async ({ page }) => {
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

  test("selecting option shows Outcome feedback with consequence and effects", async ({ page }) => {
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
                effects: [{ dimension: `Wisdom ${uniqueId}`, impact: "positive" }],
                text: "Choice A",
              },
              {
                consequence: "Cautious approach",
                effects: [{ dimension: "Wisdom", impact: "negative" }],
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
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: /choice a/i }).click();
    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(/outcome/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Bold move ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Wisdom ${uniqueId}`))).toBeVisible();
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
              { feedback: "No", isCorrect: false, text: `First ${uniqueId}` },
              { feedback: `Correct ${uniqueId}`, isCorrect: true, text: `Second ${uniqueId}` },
            ],
            question: `Shortcut test ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Press 2 to select second option
    await page.keyboard.press("2");

    // Check button should now be enabled
    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();

    // Verify via check that it selected the correct answer
    await page.keyboard.press("Enter");
    await expect(page.getByText(/correct!/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Correct ${uniqueId}`))).toBeVisible();
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

    // Check
    await page.getByRole("button", { name: /check/i }).click();
    await expect(page.getByText(/correct!/i)).toBeVisible();

    // Continue
    await page.getByRole("button", { name: /continue/i }).click();

    // Completion screen
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByText(/1\/1/)).toBeVisible();
  });
});
