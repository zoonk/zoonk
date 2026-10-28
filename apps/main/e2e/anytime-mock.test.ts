import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { WRITTEN_ESSAY } from "./anytime-mock-exams";
import {
  answerMockQuestions,
  createAnytimeMockLearner,
  failEssayGrading,
} from "./anytime-mock-fixtures";
import { expect, test } from "./fixtures";
import { REPLAN_TIMEOUT_MS } from "./plan-timeouts";
import { continueToStep } from "./result-steps";
import { openAs } from "./study-day";

/** Wait for the submitted section's response before checking its next screen. */
async function confirmMockHandIn(page: Page) {
  const mockId = new URL(page.url()).pathname.split("/").at(-1);

  const submitted = page.waitForResponse((response) => {
    const request = response.request();

    if (request.method() !== "POST" || request.url() !== page.url()) {
      return false;
    }

    const input: unknown = request.postDataJSON();

    return (
      Array.isArray(input) &&
      input[0] === mockId &&
      typeof input[1] === "number" &&
      input[2] === "UTC"
    );
  });

  await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();
  await submitted;
}

test.describe("Mocks whenever the learner wants", () => {
  test("the full exam with its written test: the essay on its own clock, the score at once, then the essay's grade", async ({
    browser,
  }) => {
    const { answers, goal, user } = await createAnytimeMockLearner({ plus: true, written: true });
    const page = await openAs(browser, user);
    // Long enough to grade: a shorter answer is "too short" without reaching a model.
    const essayText =
      "O controle externo da administração pública cabe ao Congresso Nacional, com o auxílio do Tribunal de Contas da União, que julga as contas dos administradores e fiscaliza a aplicação dos recursos federais.";

    await page.goto("/mock/new");

    // The whole exam day, the discursive test included.
    await expect(page.getByRole("radio", { name: /^A full exam day/u })).toBeChecked();
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();

    await answerMockQuestions({ answers, knows: () => true, page });
    await page.getByRole("button", { name: "Hand in this section" }).click();
    await confirmMockHandIn(page);

    // The written test on its own clock: the exam's essay question, written in the mock.
    await expect(page.getByText(/^Written part · Mathematics$/u)).toBeVisible();

    await expect(
      page.getByRole("heading", { level: 2, name: WRITTEN_ESSAY.question }),
    ).toBeVisible();

    const answer = page.getByLabel("Your answer");

    // Typing before the page hydrates is lost, so fill until the word count React keeps follows it.
    await expect(async () => {
      await answer.fill(essayText);
      await expect(page.getByText(/^\d+ words$/u)).toBeVisible({ timeout: 1000 });
    }).toPass();

    const resumeGrading = await failEssayGrading(page);
    await page.getByRole("button", { name: "Hand in the mock exam" }).click();
    await confirmMockHandIn(page);

    // The objective score shows at once.
    await expect(
      page.getByRole("heading", { level: 1, name: /^Mock exam 1 done\s*8 of 8$/u }),
    ).toBeVisible();

    const mockId = /\/mock\/(?<id>[\w-]+)$/u.exec(page.url())?.groups?.id ?? "";

    await expect
      .poll(() =>
        prisma.mockExamAnswer.findFirst({
          where: { answer: { equals: { text: essayText } }, mockExamId: mockId },
        }),
      )
      .not.toBeNull();

    // The essay's grading fails the way an outage would, and the essay offers to be graded again.
    await continueToStep(page, "Your answer");
    await expect(page.getByText("That didn't go through. Try again in a moment.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Grade it" })).toBeEnabled();
    await resumeGrading();

    // Once graded, the essay shows its grade by the exam's rubric after the score.
    const essay = await prisma.item.findFirstOrThrow({
      where: { examBlueprintId: goal.examBlueprintId, format: "essay" },
    });

    await prisma.attempt.create({
      data: {
        answer: {
          grade: {
            criteria: [
              {
                comment: "Clear thesis.",
                example: null,
                id: "criterion-1",
                maxScore: 10,
                name: "Thesis",
                quote: null,
                score: 7,
              },
            ],
            enemInterventionElements: null,
            nextStep: { criterionId: "criterion-1", text: "Back the thesis with the law." },
            range: { high: 8, low: 6 },
            total: { maxScore: 10, score: 7 },
            zeroReason: null,
          },
          text: essayText,
        },
        durationMs: 60_000,
        hour: 12,
        isCorrect: true,
        itemId: essay.id,
        localDate: new Date(new Date().toISOString().slice(0, 10)),
        mockExamId: mockId,
        userId: user.id,
        weekday: 1,
      },
    });

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: /^Mock exam 1 done/u })).toBeVisible();
    await continueToStep(page, /^Your answer/u);

    await expect(
      page.getByRole("heading", { level: 1, name: /^Your answer\s*6–8$/u }),
    ).toBeVisible();
  });

  test("a diagnostic mock as placement: stopped midway, the questions answered set where the plan starts", async ({
    browser,
  }) => {
    const { answers, goal, user } = await createAnytimeMockLearner({
      onboarding: true,
      plus: true,
    });

    const page = await openAs(browser, user);

    // On a slow connection the mock's page arrives after onboarding's wait asked for its run again
    // (every 2 s). That ask must stay with onboarding: the mock's page can't answer it.
    const unanswered: string[] = [];
    const mockPage = Promise.withResolvers<null>();

    page.on("response", (response) => {
      if (response.headers()["x-nextjs-action-not-found"]) {
        unanswered.push(response.url());
      }
    });

    await page.route(new RegExp(`/mock/placement/${goal.id}(?:\\?|$)`, "u"), async (route) => {
      await mockPage.promise;
      await route.continue();
    });

    await page.clock.install();
    await page.goto(`/start/${goal.id}`);
    await page.getByRole("link", { name: /^Or take a mock exam/u }).click();
    await page.clock.runFor(2000);
    mockPage.resolve(null);
    await expect(page).toHaveURL(new RegExp(`/mock/placement/${goal.id}$`, "u"));
    await page.getByRole("button", { name: "Start the mock exam" }).click();

    await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
    expect(unanswered).toStrictEqual([]);
    await answerMockQuestions({ answers, count: 2, knows: () => true, page });

    // Leaving keeps it running; onboarding offers to go on or stop with what was answered.
    await page.getByRole("link", { name: "Leave" }).click();
    await expect(page).toHaveURL(new RegExp(`/start/${goal.id}$`, "u"));
    await expect(page.getByRole("heading", { name: "Your mock exam is waiting" })).toBeVisible();
    await page.getByRole("button", { name: "Stop and see my plan" }).click();

    // Stopping places the learner from what was answered and plans again.
    await expect(page.getByRole("heading", { name: "Your mock exam is waiting" })).toBeHidden({
      timeout: REPLAN_TIMEOUT_MS,
    });

    const mock = await prisma.mockExam.findFirstOrThrow({ where: { goalId: goal.id } });

    expect(mock).toMatchObject({ conditions: { purpose: "placement" }, status: "finished" });

    await expect(prisma.attempt.count({ where: { mockExamId: mock.id } })).resolves.toBe(2);
  });
});
