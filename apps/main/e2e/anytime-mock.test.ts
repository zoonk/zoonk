import { type Page } from "@playwright/test";
import { writtenAnswerSchema } from "@zoonk/core/exams/essays/writing-contract";
import { prisma } from "@zoonk/db";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { isJsonObject } from "@zoonk/utils/json";
import { WRITTEN_ESSAY } from "./anytime-mock-exams";
import {
  answerMockQuestions,
  createAnytimeMockLearner,
  failEssayGrading,
} from "./anytime-mock-fixtures";
import { expect, test } from "./fixtures";
import { holdActionAnswer } from "./held-action";
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

    const exam = page.getByRole("radiogroup", { name: "Your exam has 2 tests" });
    await exam.getByText("Both tests", { exact: true }).click();
    await expect(exam.getByRole("radio", { name: /^Both tests/u })).toBeChecked();
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();

    await answerMockQuestions({ answers, knows: () => true, page });
    await page.getByRole("button", { name: "Hand in section" }).click();
    await confirmMockHandIn(page);

    await expect(page.getByText(/^Written part · Mathematics$/u)).toBeVisible();

    await expect(page.getByRole("heading", { level: 2, name: "Controle externo" })).toBeVisible();
    await expect(page.getByText(WRITTEN_ESSAY.question)).toBeVisible();

    const answer = page.getByLabel("Your answer");

    await answer.fill(essayText);
    await page.getByRole("button", { exact: true, name: "Not sure" }).click();
    await expect(page.getByText(/^about \d+ of 30 lines$/u)).toBeVisible();

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
      .toMatchObject({ flagged: true });

    await continueToStep(page, "Controle externo");
    await expect(page.getByText("Not sure", { exact: true })).toBeVisible();
    await expect(page.getByText("That didn't go through. Try again in a moment.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Grade it" })).toBeEnabled();
    await resumeGrading();

    const essay = await prisma.item.findFirstOrThrow({
      where: { examBlueprintId: goal.examBlueprintId, format: "essay" },
    });

    const sitting = await prisma.mockExam.findUniqueOrThrow({ where: { id: mockId } });
    const conditions = sitting.conditions as { writingAdmissionId?: string };

    await prisma.attempt.create({
      data: {
        answer: {
          conditions: {
            admissionId: conditions.writingAdmissionId ?? "",
            estimatedLines: 4,
            origin: "mock",
            timed: true,
            version: "firstDraft",
          },
          examBlueprintId: essay.examBlueprintId,
          grade: {
            criteria: [
              {
                comment: "Clear thesis.",
                id: "thesis",
                level: "strong",
                name: "Thesis",
                quote: null,
              },
            ],
            errors: [],
            ignoredFrom: null,
            kind: "levels",
            nextStep: {
              criterionId: "thesis",
              example: null,
              quote: null,
              text: "Back the thesis with the law.",
            },
            progress: null,
          },
          itemId: essay.id,
          text: essayText,
          writing: writtenAnswerSchema.shape.writing.parse(
            isJsonObject(essay.content) ? essay.content.writing : undefined,
          ),
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
    await continueToStep(page, "Thesis");

    await expect(page.getByText("Controle externo", { exact: true })).toBeVisible();
    await expect(page.getByText("Not sure", { exact: true })).toBeVisible();
    await expect(page.getByText("Back the thesis with the law.")).toBeVisible();
  });

  test("keeps the mock action bar in place, with no empty row, when an answer fails to save", async ({
    browser,
  }) => {
    const { user } = await createAnytimeMockLearner({ plus: true });
    const page = await openAs(browser, user);

    try {
      await page.setViewportSize({ height: 844, width: 390 });
      await page.goto("/mock/new");

      await page
        .getByRole("radiogroup", { name: "The exam" })
        .getByText("The full exam", { exact: true })
        .click();

      await page.getByRole("button", { name: "Start" }).click();
      await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();

      const frame = page.locator('[data-slot="task-frame"]');
      const bar = frame.locator('[data-slot="bottom-bar"]');
      const height = () => bar.evaluate((element) => element.getBoundingClientRect().height);
      await expect(bar).toBeVisible();
      const before = await height();

      const emptyRows = await bar
        .locator('[data-slot="bottom-bar-row"]')
        .evaluate(
          (row) =>
            [...row.children].filter(
              (child) =>
                child instanceof HTMLElement &&
                child.getBoundingClientRect().height > 0 &&
                child.innerText.trim() === "",
            ).length,
        );

      expect(emptyRows).toBe(0);

      await page.route(page.url(), (route) => {
        const request = route.request();

        const saving =
          request.method() === "POST" && request.postData()?.includes('"selectedIndex"');

        return saving ? route.abort() : route.fallback();
      });

      const answer = frame.getByRole("radio").first();
      await answer.click();

      await expect(bar.getByRole("button", { name: "Try again" })).toBeVisible();
      await expect(answer).toBeChecked();
      expect(await height()).toBe(before);
    } finally {
      await page.context().close();
    }
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

  test("leaving while a mock starts goes where the learner tapped at once, never into the mock", async ({
    browser,
  }) => {
    const { user } = await createAnytimeMockLearner({ plus: true });
    const page = await openAs(browser, user);
    await page.goto("/mock/new");
    const exam = page.getByRole("radiogroup", { name: "The exam" });
    await exam.getByText("The full exam", { exact: true }).click();
    const start = await holdActionAnswer(page, "/mock/new");

    await page.getByRole("button", { name: "Start" }).click();
    await start.held;
    await page.getByRole("link", { exact: true, name: "Your exam" }).click();
    await expect(page).toHaveURL(/\/exam$/u);

    expect(await start.release(/\/mock\/[\da-f-]{36}$/u)).toBe(false);
    await expect(page).toHaveURL(/\/exam$/u);

    await page.context().close();
  });
});
