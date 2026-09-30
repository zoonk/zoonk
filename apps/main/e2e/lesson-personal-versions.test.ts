import { prisma } from "@zoonk/db";
import { challengeCaseFixture } from "@zoonk/testing/fixtures/challenge-contents";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { isJsonObject } from "@zoonk/utils/json";
import { type Page, expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

/**
 * The personal layer over shared lessons, as a copy of the huge learn goal persona (Maya) sees
 * it in Focus or in Fun: hands-on screens in the tool she said she has, or as examples when she
 * installs nothing, graded as she saw them, and a chapter challenge set in her field of work.
 * Versions are made ahead by session preparation; here they're stored before the lesson opens.
 */

const PYTHON = "Python";
const SHARED_TITLE = "A cloud, not a little ball";

const pythonExplanation = {
  text: "In Python, `max([3, 9, 4])` returns `9`: the biggest value in the list.",
  title: "The biggest value in Python",
};

const pythonCheck = {
  options: [
    { id: "nine", isCorrect: true, reason: "max returns the biggest value.", text: "9" },
    {
      id: "three",
      isCorrect: false,
      reason: "That's the first value, not the biggest.",
      text: "3",
    },
  ],
  question: "Which value does max return for the list 3, 9 and 4?",
};

const noInstallExplanation = {
  text: "Here's what you'd see: typing `python3 --version` prints `Python 3.13.1`.",
  title: "What the terminal shows",
};

/** Her plan has the lesson in a chapter that uses Python, with her answer on the tools card. */
async function lessonInPythonChapter({
  choice,
  goalId,
}: {
  choice: "have" | "none";
  goalId: string;
}) {
  const [{ lesson, steps }, chapter, plan] = await Promise.all([
    playableLessonFixture({
      lesson: { title: "Lists in Python" },
      steps: ["explanation", "check"],
    }),
    libraryChapterFixture({ tools: [{ essential: true, name: PYTHON }] }),
    prisma.plan.findUniqueOrThrow({ where: { goalId } }),
  ]);

  const settings = isJsonObject(plan.settings) ? plan.settings : {};

  await Promise.all([
    prisma.plan.update({
      data: { settings: { ...settings, tools: [{ choice, name: PYTHON }] } },
      where: { id: plan.id },
    }),
    planItemFixture({ chapterId: chapter.id, lessonId: lesson.id, planId: plan.id }),
  ]);

  return { lessonId: lesson.id, steps };
}

function stepId(steps: { id: string; kind: string }[], kind: string): string {
  return steps.find((step) => step.kind === kind)?.id ?? "";
}

async function expectVerdict(page: Page, verdict: string) {
  await expect(page.getByRole("status").filter({ hasText: verdict })).toBeVisible();
}

test.describe("Personal versions of shared lessons", () => {
  test("shows hands-on screens in the learner's tool and grades what they saw", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "focus", persona: "hugeGoal" }, async ({ page, user }) => {
      const { lessonId, steps } = await lessonInPythonChapter({
        choice: "have",
        goalId: user.goalId,
      });

      await Promise.all([
        stepVariantFixture({
          content: pythonExplanation,
          key: "python",
          kind: "tool",
          stepId: stepId(steps, "explanation"),
        }),
        stepVariantFixture({
          content: pythonCheck,
          key: "python",
          kind: "tool",
          stepId: stepId(steps, "check"),
        }),
      ]);

      await page.goto(`/learn/${lessonId}`);

      await expect(page.getByText(pythonExplanation.title)).toBeVisible();
      await expect(page.getByText(SHARED_TITLE)).toBeHidden();

      await page.getByRole("button", { name: /^Next/u }).click();
      await expect(page.getByText(pythonCheck.question)).toBeVisible();
      await page.getByRole("radio", { name: "9" }).click();
      await page.keyboard.press("Enter");
      await expectVerdict(page, "Correct!");
    });
  });

  test("teaches with examples instead of steps on the learner's device", async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "hugeGoal" }, async ({ page, user }) => {
      const { lessonId, steps } = await lessonInPythonChapter({
        choice: "none",
        goalId: user.goalId,
      });

      await stepVariantFixture({
        content: noInstallExplanation,
        key: "no-install",
        kind: "tool",
        stepId: stepId(steps, "explanation"),
      });

      await page.goto(`/learn/${lessonId}`);

      await expect(page.getByText(noInstallExplanation.title)).toBeVisible();
      await expect(page.getByText(SHARED_TITLE)).toBeHidden();
    });
  });

  test("sets the chapter challenge in the learner's field", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "hugeGoal" }, async ({ page, user }) => {
      const [{ lesson, steps }, goal, plan] = await Promise.all([
        playableLessonFixture({ lesson: { title: "Challenge: A/B tests" }, steps: ["challenge"] }),
        prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } }),
        prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } }),
      ]);

      const details = isJsonObject(goal.details) ? goal.details : {};
      const nursingCase = { ...challengeCaseFixture(), title: "Did the new routine cut falls?" };

      await Promise.all([
        prisma.goal.update({
          data: { details: { ...details, field: "nursing", purpose: "work", role: "Nurse" } },
          where: { id: goal.id },
        }),
        planItemFixture({ lessonId: lesson.id, planId: plan.id }),
        stepVariantFixture({
          content: nursingCase,
          key: "nursing",
          kind: "field",
          stepId: stepId(steps, "challenge"),
        }),
      ]);

      await page.goto(`/learn/${lesson.id}`);

      await expect(page.getByRole("heading", { name: nursingCase.title })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Does button B sell more?" })).toBeHidden();
    });
  });
});
