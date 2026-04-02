import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

async function createMultipleChoiceActivity(options: {
  steps: { content: object; position: number }[];
}) {
  const org = await getAiOrganization();

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
    kind: "explanation",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E MC Activity ${uniqueId}`,
  });

  // Create a second activity so the tested one is not the last in the lesson.
  // This ensures tests see mid-lesson completion behavior (not lesson-complete).
  await Promise.all([
    ...options.steps.map((step) =>
      stepFixture({
        activityId: activity.id,
        content: step.content,
        isPublished: true,
        kind: "multipleChoice",
        position: step.position,
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

  test("correct answer shows feedback screen with user's answer highlighted", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            kind: "core",
            options: [
              {
                feedback: `Wrong answer ${uniqueId}`,
                isCorrect: false,
                text: `Option A ${uniqueId}`,
              },
              { feedback: `Well done ${uniqueId}`, isCorrect: true, text: `Option B ${uniqueId}` },
            ],
            question: `Test question ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: new RegExp(`Option B ${uniqueId}`, "i") }).click();
    await page.getByRole("button", { name: /check/i }).click();

    // Feedback screen shows the user's answer and feedback message
    await expect(page.getByText(/your answer:/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Option B ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Well done ${uniqueId}`))).toBeVisible();

    // No "Correct answer:" line when the user got it right
    await expect(page.getByText(/correct answer:/i)).not.toBeVisible();

    // Question and options are NOT visible (replaced by feedback screen)
    await expect(page.getByText(new RegExp(`Test question ${uniqueId}`))).not.toBeVisible();
  });

  test("incorrect answer shows feedback screen with user and correct answers", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            kind: "core",
            options: [
              { feedback: `Nope ${uniqueId}`, isCorrect: false, text: `Wrong choice ${uniqueId}` },
              { feedback: "Good job", isCorrect: true, text: `Right choice ${uniqueId}` },
            ],
            question: `Test question ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: new RegExp(`Wrong choice ${uniqueId}`, "i") }).click();
    await page.getByRole("button", { name: /check/i }).click();

    // Feedback screen shows answer lines and feedback message
    await expect(page.getByText(/your answer:/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Nope ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Wrong choice ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Right choice ${uniqueId}`))).toBeVisible();

    // Question and options are NOT visible (replaced by feedback screen)
    await expect(page.getByText(new RegExp(`Test question ${uniqueId}`))).not.toBeVisible();
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

    // Feedback screen appears with answer and feedback
    await expect(page.getByText(/your answer:/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Feedback ${uniqueId}`))).toBeVisible();

    // Question no longer visible
    await expect(page.getByText(new RegExp(`Enter key test ${uniqueId}`))).not.toBeVisible();
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

    // Verify pressing Enter submits and shows feedback screen
    await page.keyboard.press("Enter");
    await expect(page.getByText(new RegExp(`Feedback [AB] ${uniqueId}`))).toBeVisible();

    // Question no longer visible (feedback screen)
    await expect(page.getByText(new RegExp(`Shortcut test ${uniqueId}`))).not.toBeVisible();
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

  test("clicking a selected option unselects it", async ({ page }) => {
    const { url } = await createMultipleChoiceActivity({
      steps: [
        {
          content: {
            kind: "core",
            options: [
              { feedback: "No", isCorrect: false, text: "Toggle A" },
              { feedback: "Yes", isCorrect: true, text: "Toggle B" },
            ],
            question: "Toggle test",
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    const option = page.getByRole("radio", { name: /toggle a/i });

    // Select the option
    await option.click();
    await expect(option).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();

    // Click again to unselect
    await option.click();
    await expect(option).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("button", { name: /check/i })).toBeDisabled();
  });

  test("feedback screen replaces step after checking", async ({ page }) => {
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

    // Feedback screen replaces the step
    await expect(page.getByText(/your answer:/i)).toBeVisible();

    // Options are not visible (feedback screen replaces the step)
    await expect(
      page.getByRole("radio", { name: new RegExp(`Opt A ${uniqueId}`, "i") }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("radio", { name: new RegExp(`Opt B ${uniqueId}`, "i") }),
    ).not.toBeVisible();
  });

  test("feedback screen shows both answers when user answers incorrectly", async ({ page }) => {
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

    // Feedback screen shows both answers
    await expect(page.getByText(/your answer:/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Wrong opt ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(/correct answer:/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Right opt ${uniqueId}`))).toBeVisible();
  });

  test("full flow: select -> check -> feedback screen -> continue -> completion", async ({
    page,
  }) => {
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

    // Check - feedback screen replaces question
    await page.getByRole("button", { name: /check/i }).click();
    await expect(page.getByText(/your answer:/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Good ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Full flow test ${uniqueId}`))).not.toBeVisible();

    // Continue
    await page.getByRole("button", { name: /continue/i }).click();

    // Completion screen
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByText(/1\/1/)).toBeVisible();
  });
});
