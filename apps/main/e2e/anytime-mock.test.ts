import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { answerMockQuestions, createAnytimeMockLearner } from "./anytime-mock-fixtures";
import { expect, test } from "./fixtures";
import { continueToStep } from "./result-steps";
import { openAs } from "./study-day";

test.describe("Mocks whenever the learner wants", () => {
  test("one subject from the exam page, at the exam's pace; its result says each topic and skips what it showed they know only once they say so", async ({
    browser,
  }) => {
    const { answers, plan, skills, user } = await createAnytimeMockLearner({ plus: true });
    const [known] = skills;
    const page = await openAs(browser, user);

    await page.goto("/exam");
    await page.getByRole("link", { name: /^Take a mock exam/u }).click();
    await expect(page).toHaveURL(/\/mock\/new$/u);

    // Each mock with its honest size: the day, half of it, and each subject.
    await expect(page.getByRole("heading", { level: 1, name: "Take a mock exam" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /^Full exam/u })).toBeChecked();
    await expect(page.getByText("16 questions · about 24 min")).toBeVisible();
    await expect(page.getByRole("radio", { name: /^Half the exam/u })).toBeVisible();
    await expectAccessibleScreen(page, "the mocks to pick from");

    // The exam's mocks answer to their number; Enter starts the one picked.
    await page.keyboard.press("2");
    await expect(page.getByRole("radio", { name: /^Half the exam/u })).toBeChecked();
    await page.getByRole("radio", { name: /^Mathematics/u }).click();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/mock\/[\w-]+$/u);
    await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();

    // Every question on the first topic right, the other wrong.
    await answerMockQuestions({
      answers,
      knows: (question) => question.skill === known?.name,
      page,
    });

    await page.getByRole("button", { name: "Hand in the mock exam" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();

    await expect(page.getByRole("heading", { level: 1, name: /^Mock exam 1 done/u })).toBeVisible();

    // How each topic went, the one that went worst first.
    await continueToStep(page, "By topic", { keyboard: true });
    await expect(page.getByText("0 of 4")).toBeVisible();
    await expect(page.getByText("4 of 4")).toBeVisible();

    // The plan changes only once the learner says so.
    await continueToStep(page, /^You got everything right in/u);

    await expect(
      prisma.planItem.count({ where: { planId: plan.id, status: "testedOut" } }),
    ).resolves.toBe(0);

    await expectAccessibleScreen(page, "a mock's offer to skip lessons");
    await page.getByRole("button", { name: "Skip the lesson" }).click();
    await expect(page.getByRole("status")).toHaveText(/^Done: 1 lesson off your plan\./u);

    await expect
      .poll(() =>
        prisma.planItem.findFirst({ where: { planId: plan.id, skillId: known?.id ?? "" } }),
      )
      .toMatchObject({ status: "testedOut" });

    // It joins the exam's history, where its result opens again.
    await page.goto("/exam");
    await page.getByRole("link", { name: /^Mock exam 1/u }).click();
    await expect(page.getByRole("heading", { level: 1, name: /^Mock exam 1 done/u })).toBeVisible();
  });

  test("come with Plus: the free plan sees each mock and what it takes", async ({ browser }) => {
    const { user } = await createAnytimeMockLearner({ plus: false });
    const page = await openAs(browser, user);

    // The exam page shows the mocks as Plus learners see them, marked Plus, with one notice.
    await page.goto("/exam");
    await expect(page.getByText(/^Mock exams come with Plus/u)).toBeVisible();
    await expect(page.getByRole("link", { name: "See Plus" })).toHaveCount(1);
    await page.getByRole("link", { name: /^Take a mock exam.*Available with Plus$/u }).click();
    await expect(page).toHaveURL(/\/mock\/new$/u);

    await expect(page.getByRole("radio", { name: /^Mathematics/u })).toBeVisible();
    // The exam page stays mounted, hidden, for the way back: only what's on screen counts.
    await expect(
      page.getByText(/^Mock exams come with Plus/u).filter({ visible: true }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "See Plus" })).toHaveAttribute(
      "href",
      "/subscription",
    );

    await expect(page.getByRole("button", { name: "Start" })).toBeHidden();

    // Escape leaves for the exam page.
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/exam$/u);
  });

  test("offers none while no mock can be built, as for a class test with no material", async ({
    browser,
  }) => {
    const { user } = await createAnytimeMockLearner({ material: false, plus: true });
    const page = await openAs(browser, user);

    await page.goto("/exam");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Take a mock exam/u })).toHaveCount(0);

    await page.goto("/mock/new");
    await expect(page).toHaveURL(/\/exam$/u);
  });

  test("a diagnostic mock as placement, in the length picked: stopped midway, the questions answered set where the plan starts", async ({
    browser,
  }) => {
    const { answers, goal, user } = await createAnytimeMockLearner({
      onboarding: true,
      plus: true,
    });

    const page = await openAs(browser, user);

    await page.goto(`/start/${goal.id}`);

    await expect(
      page.getByRole("heading", { name: "Let's see what you already know" }),
    ).toBeVisible();

    // The quick questions stay the default; the mock says how long it can take.
    await expect(page.getByRole("button", { exact: true, name: "Start" })).toBeVisible();

    await page
      .getByRole("link", { name: /^Or take a mock exam.*15 min to 24 min\. You pick how long\./u })
      .click();

    await expect(page).toHaveURL(new RegExp(`/mock/placement/${goal.id}$`, "u"));

    await expect(
      page.getByRole("heading", { level: 1, name: "A mock exam to find your level" }),
    ).toBeVisible();

    // One choice of lengths, each with its time: the quick check is suggested and picked, and the
    // learner can take longer.
    await expect(page.getByRole("radio", { name: /^About 15 min \(recommended\)/u })).toBeChecked();
    await expect(page.getByRole("radio", { name: /^About 24 min/u })).not.toBeChecked();

    await expect(
      page.getByText("10 questions · A quick check. Your first days fine-tune it."),
    ).toBeVisible();

    await expectAccessibleScreen(page, "the placement mock");

    // The keyboard picks a length too, and the suggested one stays one press away.
    await page.keyboard.press("2");
    await expect(page.getByRole("radio", { name: /^About 24 min/u })).toBeChecked();
    await page.keyboard.press("1");
    await expect(page.getByRole("radio", { name: /^About 15 min/u })).toBeChecked();
    await page.getByRole("button", { name: "Start the mock exam" }).click();

    await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
    await expect(page.getByText(/^Question 1 of 10/u)).toBeVisible();
    await answerMockQuestions({ answers, count: 2, knows: () => true, page });

    // Leaving keeps it running; onboarding offers to go on or stop with what was answered.
    await page.getByRole("link", { name: "Leave" }).click();
    await expect(page).toHaveURL(new RegExp(`/start/${goal.id}$`, "u"));
    await expect(page.getByRole("heading", { name: "Your mock exam is waiting" })).toBeVisible();
    await page.getByRole("button", { name: "Stop and see my plan" }).click();
    await expect(page.getByRole("heading", { name: "Your mock exam is waiting" })).toBeHidden();

    const mock = await prisma.mockExam.findFirstOrThrow({ where: { goalId: goal.id } });

    expect(mock).toMatchObject({ conditions: { purpose: "placement" }, status: "finished" });

    await expect(prisma.attempt.count({ where: { mockExamId: mock.id } })).resolves.toBe(2);
  });

  test("the free plan sees the diagnostic mock with what it takes, and places with the quick questions", async ({
    browser,
  }) => {
    const { goal, user } = await createAnytimeMockLearner({ onboarding: true, plus: false });
    const page = await openAs(browser, user);

    await page.goto(`/start/${goal.id}`);

    await page
      .getByRole("link", {
        name: /^Or take a mock exam.*You pick how long\..*Available with Plus$/u,
      })
      .click();

    await expect(page).toHaveURL(new RegExp(`/mock/placement/${goal.id}$`, "u"));

    // The lengths show as Plus learners see them, with their times.
    await expect(page.getByRole("radio", { name: /^About 15 min \(recommended\)/u })).toBeVisible();
    await expect(page.getByRole("radio", { name: /^About 24 min/u })).toBeVisible();
    await expect(page.getByText(/^Mock exams come with Plus\. Without it/u)).toBeVisible();
    await expect(page.getByRole("link", { name: "See Plus" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start the mock exam" })).toBeHidden();

    // Escape goes back to the quick questions, which start as before.
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(new RegExp(`/start/${goal.id}$`, "u"));
    await expect(page.getByRole("button", { exact: true, name: "Start" })).toBeVisible();
    await expect(prisma.mockExam.count({ where: { goalId: goal.id } })).resolves.toBe(0);
  });
});
