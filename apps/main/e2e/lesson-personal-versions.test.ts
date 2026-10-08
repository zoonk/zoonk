import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";

/**
 * The personal layer over shared lessons, as the page serves it: hands-on screens in the tool the
 * learner said they have, graded as they saw them. Versions are made ahead by session preparation;
 * here they're stored before the lesson opens. Core's tests cover which version each learner gets
 * (no-install examples, a challenge in their field).
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

/** The learner's plan has the lesson in a chapter that uses Python, which they said they have. */
async function lessonInPythonChapter(userId: string) {
  const [{ lesson, steps }, chapter, goal] = await Promise.all([
    playableLessonFixture({
      lesson: { title: "Lists in Python" },
      steps: ["explanation", "check"],
    }),
    libraryChapterFixture({ tools: [{ essential: true, name: PYTHON }] }),
    goalFixture({ userId }),
  ]);

  const plan = await planFixture({
    goalId: goal.id,
    settings: { tools: [{ choice: "have", name: PYTHON }] },
  });

  await planItemFixture({ chapterId: chapter.id, lessonId: lesson.id, planId: plan.id });

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
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { lessonId, steps } = await lessonInPythonChapter(noProgressUser.id);

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
