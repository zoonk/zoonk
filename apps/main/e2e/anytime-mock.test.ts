import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { WRITTEN_ESSAY } from "./anytime-mock-exams";
import {
  answerMockQuestions,
  createAnytimeMockLearner,
  failEssayGrading,
} from "./anytime-mock-fixtures";
import { expect, test } from "./fixtures";
import { continueToStep } from "./result-steps";
import { openAs } from "./study-day";

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

    const essayText =
      "O controle externo da administração pública cabe ao Congresso Nacional, com o auxílio do Tribunal de Contas da União, que julga as contas dos administradores e fiscaliza a aplicação dos recursos federais.";

    await page.goto("/mock/new");

    const exam = page.getByRole("radiogroup", { name: "The exam" });
    await exam.getByText("The full exam", { exact: true }).click();
    await expect(exam.getByRole("radio", { name: /^The full exam/u })).toBeChecked();
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();

    await answerMockQuestions({ answers, knows: () => true, page });
    await page.getByRole("button", { name: "Hand in section" }).click();
    await confirmMockHandIn(page);

    await expect(page.getByText(/^Written part · Mathematics$/u)).toBeVisible();

    await expect(
      page.getByRole("heading", { level: 2, name: WRITTEN_ESSAY.question }),
    ).toBeVisible();

    const answer = page.getByLabel("Your answer");

    await answer.fill(essayText);
    await expect(page.getByText(/^\d+ words$/u)).toBeVisible();

    const resumeGrading = await failEssayGrading(page);

    await page
      .getByRole("complementary", { name: "Answer sheet" })
      .getByRole("button", { name: "Hand in" })
      .click();

    await confirmMockHandIn(page);

    await expect(
      page.getByRole("heading", { level: 1, name: /^Mock exam 1\s*8 of 8$/u }),
    ).toBeVisible();

    const mockId = /\/mock\/(?<id>[\w-]+)$/u.exec(page.url())?.groups?.id ?? "";

    await expect
      .poll(() =>
        prisma.mockExamAnswer.findFirst({
          where: { answer: { equals: { text: essayText } }, mockExamId: mockId },
        }),
      )
      .not.toBeNull();

    await continueToStep(page, "Your answer");
    await expect(page.getByText("That didn't go through. Try again in a moment.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Grade it" })).toBeEnabled();
    await resumeGrading();

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
    await expect(page.getByRole("heading", { level: 1, name: /^Mock exam 1/u })).toBeVisible();
    await continueToStep(page, /^Your answer/u);

    await expect(
      page.getByRole("heading", { level: 1, name: /^Your answer\s*6–8$/u }),
    ).toBeVisible();
  });

  test("a free learner picks a mock exam like anyone and meets the gate at Start", async ({
    browser,
  }) => {
    const { user } = await createAnytimeMockLearner({ plus: false });
    const page = await openAs(browser, user);

    await page.goto("/mock/new");

    const exam = page.getByRole("radiogroup", { name: "The exam" });
    await exam.getByText("The full exam", { exact: true }).click();
    await page.getByRole("button", { name: "Start" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Mock exams need a subscription" }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: /^Subscribe/u })).toHaveAttribute(
      "href",
      /\/subscription$/u,
    );

    await expect(page.getByRole("button", { name: "Start" })).toBeHidden();
    await expect(prisma.mockExam.count({ where: { userId: user.id } })).resolves.toBe(0);
    await page.context().close();
  });

  test("a mock exam that comes out shorter than the one picked starts only once the learner agrees", async ({
    browser,
  }) => {
    const { user } = await createAnytimeMockLearner({ plus: true, questionsPerSkill: 2 });
    // Today's question writing is used up, so nothing more can be written for the full exam.
    await usageRecordsFixture({ count: 2, kind: "mockQuestions", userId: user.id });
    const page = await openAs(browser, user);
    const mocks = () => prisma.mockExam.count({ where: { userId: user.id } });

    await page.goto("/mock/new");

    const start = page.getByRole("button", { name: "Start" });
    await expect(start).toBeDisabled();

    const exam = page.getByRole("radiogroup", { name: "The exam" });
    await exam.getByText("The full exam", { exact: true }).click();
    await start.click();

    const shorter = page.getByRole("alertdialog", { name: "Start a shorter mock exam?" });
    await expect(shorter).toContainText("8 of its 16 questions");

    await shorter.getByRole("button", { name: "Pick another" }).click();
    await expect(shorter).toBeHidden();
    await expect(exam.getByRole("radio", { name: /^The full exam/u })).toBeChecked();
    await expect(mocks()).resolves.toBe(0);

    await start.click();
    await shorter.getByRole("button", { name: "Start" }).click();

    await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
    await expect.poll(mocks).toBe(1);
    await page.context().close();
  });
});
