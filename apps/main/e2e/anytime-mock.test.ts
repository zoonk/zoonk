import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { WRITTEN_ESSAY } from "./anytime-mock-exams";
import {
  answerMockQuestions,
  createAnytimeMockLearner,
  failEssayGrading,
} from "./anytime-mock-fixtures";
import { expect, test } from "./fixtures";
import { followRun } from "./generation-run";
import { holdActionAnswer } from "./held-action";
import { continueToStep } from "./result-steps";
import { openAs } from "./study-day";

const MOCK_READ_AGAIN_MS = 15_000;

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

  test("a mock exam still being prepared says so, and Start comes back once it's ready", async ({
    browser,
  }) => {
    const { blueprint, skills, user } = await createAnytimeMockLearner({
      plus: true,
      questionsPerSkill: 2,
    });

    const page = await openAs(browser, user);
    const mocks = () => prisma.mockExam.count({ where: { userId: user.id } });
    await page.clock.install();
    await page.goto("/mock/new");

    const start = page.getByRole("button", { name: "Start" });
    const keepStudying = page.getByRole("link", { name: "Keep studying" });
    const exam = page.getByRole("radiogroup", { name: "The exam" });
    await expect(start).toBeDisabled();

    await exam.getByText("The full exam", { exact: true }).click();
    const startBox = await start.boundingBox();
    await start.click();

    await expect(page.getByText("Getting this mock exam ready")).toBeVisible();
    await expect(keepStudying).toHaveAttribute("href", /\/today$/u);
    await expect(start).toBeHidden();

    const keepBox = await keepStudying.boundingBox();

    expect(keepBox?.y).toBe(startBox?.y);

    expect((keepBox?.x ?? 0) + (keepBox?.width ?? 0)).toBe(
      (startBox?.x ?? 0) + (startBox?.width ?? 0),
    );

    await expect(mocks()).resolves.toBe(0);

    await exam.getByText("Half the exam", { exact: true }).click();
    await expect(start).toBeEnabled();
    await expect(page.getByText("Getting this mock exam ready")).toBeHidden();

    await exam.getByText("The full exam", { exact: true }).click();
    await expect(keepStudying).toBeVisible();

    await Promise.all(
      skills.flatMap((skill) =>
        [3, 4].map((copy) =>
          itemFixture({
            content: choiceItemContent(`${skill.name}, question ${copy}?`),
            examBlueprintId: blueprint.id,
            mockOnly: true,
            skillId: skill.id,
          }),
        ),
      ),
    );

    await page.clock.runFor(MOCK_READ_AGAIN_MS);
    await expect(start).toBeEnabled();
    await expect(keepStudying).toBeHidden();
    await expect(mocks()).resolves.toBe(0);

    await start.click();
    await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
    await expect.poll(mocks).toBe(1);
    await page.context().close();
  });

  test("a scheduled mock follows its paper after a long queue and offers Start when it is written", async ({
    browser,
  }) => {
    const { blueprint, goal, plan, skills, user } = await createAnytimeMockLearner({
      plus: true,
      questionsPerSkill: 0,
    });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const mock = await planItemFixture({ kind: "mock", planId: plan.id, scheduledFor: today });
    const runId = "scheduled-paper";
    const namespace = `mock-paper:${goal.id}:${today.toISOString()}`;
    const events = [{ at: Date.now(), status: "started", step: "writeMockQuestions" }];
    const page = await openAs(browser, user);

    try {
      await page.clock.install();
      await followRun({ events, page, runId });

      const starting = { generationId: null, namespace: null, status: "starting" };
      let claimed = false;

      await page.route(`**/v1/goals/${goal.id}/mock-writing?*`, (route) =>
        route.fulfill({
          json: claimed ? { generationId: runId, namespace, status: "writing" } : starting,
        }),
      );

      const lookup = page.waitForResponse(
        (response) => new URL(response.url()).pathname === `/v1/goals/${goal.id}/mock-writing`,
      );

      await page.goto(`/challenge/${mock.id}`);
      await lookup;
      await page.clock.fastForward(60_000);
      await expect(page.getByRole("progressbar")).toBeVisible();

      const stream = page.waitForRequest(
        (request) =>
          request.method() === "GET" &&
          new URL(request.url()).pathname === `/v1/generations/${runId}/events`,
      );

      claimed = true;
      const request = await stream;
      expect(new URL(request.url()).searchParams.get("namespace")).toBe(namespace);

      const start = page.getByRole("button", { exact: true, name: "Start" });
      await expect(page.getByText(/Writing the questions · About/u)).toBeVisible();
      await expect(page.getByRole("link", { name: "Keep studying" })).toBeVisible();
      await expect(start).toBeHidden();

      await Promise.all(
        skills.flatMap((skill) =>
          Array.from({ length: 4 }, (_, index) =>
            itemFixture({
              content: choiceItemContent(`${skill.name}, question ${index + 1}?`),
              examBlueprintId: blueprint.id,
              mockOnly: true,
              skillId: skill.id,
            }),
          ),
        ),
      );

      events.push({ at: Date.now(), status: "completed", step: "mockPaperReady" });

      await expect(start).toBeEnabled();
    } finally {
      await page.context().close();
    }
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
