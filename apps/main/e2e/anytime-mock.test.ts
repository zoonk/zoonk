import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { SECTION_TOOLS, TEXT_SET, WRITTEN_ESSAY, WRITTEN_PASS_MARK } from "./anytime-mock-exams";
import {
  answerFormatsMock,
  answerMockQuestions,
  createAnytimeMockLearner,
} from "./anytime-mock-fixtures";
import { expect, test } from "./fixtures";
import { continueToStep } from "./result-steps";
import { openAs } from "./study-day";

const knowsMathematics = (question: { area: string }) => question.area === "Mathematics";

/** Picks a mock as a learner does, with a tap on its row: the radio itself is for assistive tech. */
function pickMock(page: Page, name: RegExp) {
  return page
    .locator("label")
    .filter({ has: page.getByRole("radio", { name }) })
    .click();
}

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
    await expect(page.getByRole("radio", { name: /^A full exam day/u })).toBeChecked();
    await expect(page.getByText("16 q · ~24 min")).toBeVisible();
    await expect(page.getByRole("radio", { name: /^Half an exam day/u })).toBeVisible();
    await expectAccessibleScreen(page, "the mocks to pick from");

    // The exam's mocks answer to their number; Enter starts the one picked.
    await page.keyboard.press("2");
    await expect(page.getByRole("radio", { name: /^Half an exam day/u })).toBeChecked();
    await pickMock(page, /^Mathematics/u);
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
    const topics = page.getByRole("region", { name: "By topic" });
    await expect(topics).toBeVisible();
    await expect(topics.getByText("0 of 4")).toBeVisible();
    await expect(topics.getByText("4 of 4")).toBeVisible();

    // The plan changes only once the learner says so.
    const after = page.getByRole("complementary", { name: "After this mock exam" });
    const change = after.getByRole("group", { name: /^You got everything right in/u });
    await expect(change).toBeVisible();

    await expect(
      prisma.planItem.count({ where: { planId: plan.id, status: "testedOut" } }),
    ).resolves.toBe(0);

    await expectAccessibleScreen(page, "a mock's offer to skip lessons");
    await change.getByRole("button", { name: "Apply" }).click();
    await expect(change.getByRole("status")).toHaveText(/^Done: 1 lesson off your plan\./u);

    await expect
      .poll(() =>
        prisma.planItem.findFirst({ where: { planId: plan.id, skillId: known?.id ?? "" } }),
      )
      .toMatchObject({ status: "testedOut" });

    // It joins the exam's history, where its result opens again.
    await page.goto("/exam");
    await page.getByRole("link", { name: /^Mock exam 1/u }).click();
    await expect(page.getByRole("heading", { level: 1, name: /^Mock exam 1 done/u })).toBeVisible();

    // A hard reload draws the wide screen's one page from the server, before any script runs: the
    // questions on it, the plan beside it, no steps to go through.
    await page.route(/\/_next\/static\/chunks\/.+\.js/u, (route) => route.abort());
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: /^Mock exam 1 done/u })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Questions to review" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeHidden();
    await expect(page.getByRole("img", { name: /^Step 1 of/u })).toBeHidden();
  });

  // A Start the server never answered (its transaction couldn't begin on a busy server) left the
  // chooser on "Getting it ready…", then on an error page.
  test("a Start that doesn't go through says so and starts on the next tap", async ({
    browser,
  }) => {
    const { user } = await createAnytimeMockLearner({ plus: true });
    const page = await openAs(browser, user);
    let dropped = false;

    await page.goto("/mock/new");

    // The connection drops once, on the Start's own request.
    await page.route("**/mock/new", async (route) => {
      if (
        !dropped &&
        route.request().method() === "POST" &&
        route.request().headers()["next-action"]
      ) {
        dropped = true;
        await route.abort();
        return;
      }

      await route.fallback();
    });

    const start = page.getByRole("button", { exact: true, name: "Start" });
    await start.click();

    await expect(page.getByText("We couldn't start the mock. Try again.")).toBeVisible();
    await expect(start).toBeEnabled();
    await expect.poll(() => prisma.mockExam.count({ where: { userId: user.id } })).toBe(0);

    await start.click();
    await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
    await page.context().close();
  });

  // Ana left her mock with 4 of 45 answered: "Continue your mock exam" was its only trace on the
  // exam's page.
  test("a mock left running leads the exam's mocks, with what's answered and the time left", async ({
    browser,
  }) => {
    const { answers, user } = await createAnytimeMockLearner({ plus: true });
    const page = await openAs(browser, user);

    await page.goto("/mock/new");
    await pickMock(page, /^Mathematics/u);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();

    await answerMockQuestions({ answers, count: 2, knows: () => true, page });
    const mockId = /\/mock\/(?<id>[\w-]+)$/u.exec(page.url())?.groups?.id ?? "";

    await expect.poll(() => prisma.mockExamAnswer.count({ where: { mockExamId: mockId } })).toBe(2);

    await page.goto("/exam");

    const running = page.getByRole("list", { name: "Mock exams" }).getByRole("listitem").first();

    await expect(running).toHaveAttribute("aria-current", "step");
    await expect(running).toHaveText(/^Mock exam 1.*\d+\smin left$/u);

    // The row opens the mock where she left it.
    await running.getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`/mock/${mockId}$`, "u"));
    await expect(page.getByText(/^Question 3 of 8/u)).toBeVisible();

    await page.goBack();
    await expect(running.getByText("Mathematics · 2 of 8 answered")).toBeVisible();
  });

  test("the full exam with its written test: the essay on its own clock, the score and the notice's pass mark at once, then the essay's grade", async ({
    browser,
  }) => {
    const { answers, goal, user } = await createAnytimeMockLearner({ plus: true, written: true });
    const page = await openAs(browser, user);
    // Long enough to grade: a shorter answer is "too short" without reaching a model.
    const essayText =
      "O controle externo da administração pública cabe ao Congresso Nacional, com o auxílio do Tribunal de Contas da União, que julga as contas dos administradores e fiscaliza a aplicação dos recursos federais.";

    await page.goto("/mock/new");

    // The whole exam day, the discursive test with its own half hour included.
    await expect(page.getByRole("radio", { name: /^A full exam day/u })).toBeChecked();
    await expect(page.getByText("+ Prova discursiva", { exact: true })).toBeVisible();
    await expect(page.getByText("8 q · ~42 min")).toBeVisible();

    // The main action keeps its 44px however the bar lays it out.
    const start = page.getByRole("button", { name: "Start" });
    const startBox = await start.boundingBox();
    expect(startBox?.height).toBe(44);
    await start.click();
    await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();

    await answerMockQuestions({ answers, knows: () => true, page });
    await page.getByRole("button", { name: "Hand in this section" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();

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

    await expectAccessibleScreen(page, "a mock's written test");
    await page.getByRole("button", { name: "Hand in the mock exam" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();

    // The objective score shows at once, beside what the notice says it takes to pass.
    await expect(
      page.getByRole("heading", { level: 1, name: /^Mock exam 1 done\s*8 of 8$/u }),
    ).toBeVisible();

    await expect(page.getByText("To pass, the notice says")).toBeVisible();
    await expect(page.getByText(WRITTEN_PASS_MARK)).toBeVisible();

    const mockId = /\/mock\/(?<id>[\w-]+)$/u.exec(page.url())?.groups?.id ?? "";

    await expect
      .poll(() =>
        prisma.mockExamAnswer.findFirst({
          where: { answer: { equals: { text: essayText } }, mockExamId: mockId },
        }),
      )
      .not.toBeNull();

    // Tests never reach a model, so the essay's grading fails the way an outage would, and the
    // essay offers to be graded again.
    await continueToStep(page, "Your answer");
    await expect(page.getByText("That didn't go through. Try again in a moment.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Grade it" })).toBeEnabled();

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

    await expect(page.getByText("Estimated score, from 0 to 10")).toBeVisible();
  });

  test("like the real sitting: what each section allows, the break between sections, what the mock can't run, and a quarter point off per wrong answer", async ({
    browser,
  }) => {
    const { answers, user } = await createAnytimeMockLearner({ breaks: true, plus: true });
    const page = await openAs(browser, user);

    // The full exam says what it leaves out of the real one, and why.
    await page.goto("/mock/new");
    await expect(page.getByRole("radio", { name: /^A full exam day/u })).toBeChecked();

    await expect(
      page.getByText("Lab practical can't be part of a mock: it's a practical test."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Start" }).click();

    // Each section says what may be used in it, as the notice does, in its answer sheet.
    await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
    const sheet = page.getByRole("complementary", { name: "Answer sheet" });
    await expect(sheet.getByText(SECTION_TOOLS.Mathematics)).toBeVisible();
    await answerMockQuestions({ answers, knows: () => true, page });
    await page.getByRole("button", { name: "Hand in this section" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();

    // The notice's ten-minute break, with the next section and its tools; it survives a reload.
    await expect(page.getByRole("heading", { level: 1, name: "Break" })).toBeVisible();

    await expect(page.getByRole("timer", { name: "Break time left" })).toHaveText(
      /^(?:10:00|9:\d\d)$/u,
    );

    const breakBody = page.getByRole("main");
    await expect(breakBody.getByText("Next: Languages", { exact: true })).toBeVisible();
    await expect(breakBody.getByText("12 min", { exact: true })).toBeVisible();
    await expect(breakBody.getByText(SECTION_TOOLS.Languages)).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Sections" })).toBeVisible();
    await expectAccessibleScreen(page, "a mock's break between sections");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Break" })).toBeVisible();

    // Like the real exam, the next section can start before the break ends.
    await page.getByRole("button", { name: "Start the next section" }).click();
    await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
    await expect(sheet.getByText(SECTION_TOOLS.Languages)).toBeVisible();

    // Two wrong and six left blank: each wrong answer takes a quarter point, a blank one nothing.
    await answerMockQuestions({ answers, count: 2, knows: () => false, page });
    await sheet.getByRole("button", { exact: true, name: "Hand in" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: /^Mock exam 1 done\s*7\.5$/u }),
    ).toBeVisible();

    await expect(page.getByText("Net score out of 16", { exact: false })).toBeVisible();
    // Right, wrong and blank, each its own tile.
    const tile = (text: RegExp) => page.getByRole("listitem").filter({ hasText: text });
    await expect(tile(/^Right 8$/u)).toBeVisible();
    await expect(tile(/^Wrong 2$/u)).toBeVisible();
    await expect(tile(/^Blank 6$/u)).toBeVisible();

    await expect(
      page.getByText("Lab practical can't be part of a mock: it's a practical test."),
    ).toBeVisible();
  });

  test("sections that move like the real exam's: one question after another, a review with one change at the end, and a clock per question", async ({
    browser,
  }) => {
    const { answers, user } = await createAnytimeMockLearner({ navigation: true, plus: true });
    const page = await openAs(browser, user);

    await page.goto("/mock/new");
    await page.getByRole("button", { name: "Start" }).click();

    // Each question is answered before the next, and one left behind doesn't open again.
    await expect(
      page.getByText("Answer each question to move on. You can't go back to it."),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
    // The row under the question opens only the next one, never ahead of it.
    await expect(page.getByRole("button", { exact: true, name: "Question 3" })).toBeDisabled();
    await answerMockQuestions({ answers, knows: () => false, page });

    // At the last question, the review opens every question again, for one change: ← goes back.
    await expect(page.getByText("Review: you can change 1 more answer.")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText(/^Question 7 of 16/u)).toBeVisible();

    const main = page.getByRole("main");
    const heading = (await main.getByRole("heading", { level: 2 }).textContent()) ?? "";
    await page.getByRole("radio", { name: answers.get(heading.trim())?.right }).click();
    await expect(page.getByText("Review: no more answers can change.")).toBeVisible();

    await page.getByRole("button", { exact: true, name: "Question 6" }).click();
    await expect(page.getByText(/^Question 6 of 16/u)).toBeVisible();
    await expect(page.getByRole("radio").first()).toBeDisabled();
    await expectAccessibleScreen(page, "a mock section's review with its changes used");

    const sheet = page.getByRole("complementary", { name: "Answer sheet" });
    await sheet.getByRole("button", { exact: true, name: "Hand in" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();

    // Each question has its own clock: when it runs out, the next one opens.
    await expect(page.getByText(/^Question 9 of 16/u)).toBeVisible();
    await expect(page.getByRole("timer", { name: "Time left for this question" })).toBeVisible();
    await expect(page.getByText(/^Question 10 of 16/u)).toBeVisible({ timeout: 6000 });

    await sheet.getByRole("button", { exact: true, name: "Hand in" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();

    // The one change in the review is the only right answer.
    await expect(
      page.getByRole("heading", { level: 1, name: /^Mock exam 1 done\s*1 of 16$/u }),
    ).toBeVisible();
  });

  test("the exam's own scale: the result on it where the notice gives the map, and the exam page's range and pass score", async ({
    browser,
  }) => {
    const { answers, user } = await createAnytimeMockLearner({ plus: true, scale: true });
    const page = await openAs(browser, user);

    await page.goto("/exam");
    await expect(page.getByText("Scored on the Ceneval index scale")).toBeVisible();
    await expect(page.getByText("From 700 to 1,300.")).toBeVisible();
    await expect(page.getByText("To pass: 1,000 or more.")).toBeVisible();

    // Half the questions right (Mathematics, not Languages): 700 plus 6 per percent is 1,000.
    await page.goto("/mock/new");
    await page.getByRole("button", { name: "Start" }).click();
    await answerMockQuestions({ answers, knows: knowsMathematics, page });
    await page.getByRole("button", { name: "Hand in this section" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();
    await expect(page.getByText(/^Question 9 of 16/u)).toBeVisible();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    await answerMockQuestions({ answers, knows: knowsMathematics, page });
    await page.getByRole("button", { name: "Hand in the mock exam" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: /^Mock exam 1 done\s*8 of 16$/u }),
    ).toBeVisible();

    await expect(
      page.getByText("About 1,000 on the Ceneval index scale, from 700 to 1,300."),
    ).toBeVisible();

    await expect(page.getByText("To pass: 1,000 or more.")).toBeVisible();
  });

  test("the exam's own answer formats: several right options with the notice's partial credit, a fraction and a word typed in", async ({
    browser,
  }) => {
    const { answers, user } = await createAnytimeMockLearner({ formats: true, plus: true });
    const page = await openAs(browser, user);

    await page.goto("/mock/new");
    await page.getByRole("button", { name: "Start" }).click();
    await answerFormatsMock({ answers, page });
    await page.getByRole("button", { name: "Hand in the mock exam" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();

    // One of the two right options earns a quarter of its question, as the notice scores it.
    await expect(
      page.getByRole("heading", { level: 1, name: /^Mock exam 1 done\s*10\.25 of 11$/u }),
    ).toBeVisible();

    const review = page.getByRole("region", { name: "Questions to review" });
    await expect(review.getByText("Partly right: it earned part of its points.")).toBeVisible();
    await expect(review.getByText("2 + 2 = 4; 3 × 3 = 9")).toBeVisible();
  });

  test("questions that read one text come one after another, each with the text, and so does the review", async ({
    browser,
  }) => {
    const { user } = await createAnytimeMockLearner({ plus: true, textSet: true });
    const page = await openAs(browser, user);

    await page.goto("/mock/new");
    await pickMock(page, /^Mathematics/u);
    await page.getByRole("button", { name: "Start" }).click();

    const text = page.getByRole("region", { name: TEXT_SET.title });

    await expect(text.getByText("Question 1 of 3 on this text")).toBeVisible();
    await expect(text.getByText(TEXT_SET.text)).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(text.getByText("Question 2 of 3 on this text")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(text.getByText("Question 3 of 3 on this text")).toBeVisible();

    // The text's questions end; the next question stands on its own.
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/^Question 4 of 8/u)).toBeVisible();
    await expect(text).toBeHidden();

    await page
      .getByRole("complementary", { name: "Answer sheet" })
      .getByRole("button", { exact: true, name: "Hand in" })
      .click();

    await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /^Mock exam 1 done/u })).toBeVisible();

    const review = page.getByRole("region", { name: "Questions to review" });

    await expect(review.getByRole("region", { name: TEXT_SET.title })).toHaveCount(3);
  });

  test("again and again: past the day's new questions it asks the ones answered before and says so, and the exam page shows the progress", async ({
    browser,
  }) => {
    const { answers, user } = await createAnytimeMockLearner({ plus: true });
    const page = await openAs(browser, user);

    async function startMathematics() {
      await page.goto("/mock/new");
      await pickMock(page, /^Mathematics/u);
      await page.getByRole("button", { name: "Start" }).click();
      await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
    }

    async function handIn({ knows, number }: { knows: boolean; number: number }) {
      await answerMockQuestions({ answers, knows: () => knows, page });
      await page.getByRole("button", { name: "Hand in the mock exam" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();

      await expect(
        page.getByRole("heading", { level: 1, name: new RegExp(`^Mock exam ${number} done`, "u") }),
      ).toBeVisible();
    }

    // The first one asks new questions only, and says nothing about repeats.
    await startMathematics();
    await expect(page.getByText(/repeat/u)).toBeHidden();
    await handIn({ knows: false, number: 1 });

    // Beside the options, how the last mock went, opening its result.
    await page.goto("/mock/new");
    const lastMock = page.getByRole("link", { name: /^Mock exam 1/u });
    await expect(lastMock).toContainText("0 of 8 right");
    await lastMock.click();
    await expect(page.getByRole("heading", { level: 1, name: /^Mock exam 1 done/u })).toBeVisible();

    // Today's new questions for mocks are used: the same mock starts at once with the questions
    // answered before, and says so in one line. As often as the learner likes.
    await usageRecordsFixture({ count: 2, kind: "mockQuestions", userId: user.id });

    await startMathematics();

    const sheet = page.getByRole("complementary", { name: "Answer sheet" });
    await expect(sheet.getByText("8 questions repeat, missed ones first.")).toBeVisible();

    await handIn({ knows: true, number: 2 });

    await startMathematics();
    await handIn({ knows: true, number: 3 });

    // The exam page shows each mock's score over time. Eight questions of a subject, then two
    // mocks of repeats, are too little to call a subject better: it says what a trend waits for.
    await page.goto("/exam");
    const progress = page.getByRole("region", { name: "How your mocks went" });

    await expect(progress.getByText("Right answers in Mock exam 3")).toBeVisible();

    await expect(
      progress.getByText(
        "Trends by subject show once your mocks ask enough new questions of each one.",
      ),
    ).toBeVisible();

    await expect(progress.getByText(/^Better in /u)).toHaveCount(0);

    // Pointing at the chart, or its arrow keys, picks a mock and says its score and which it was.
    const chart = progress.getByRole("slider", { name: "Your mock exam scores, from 0% to 100%" });

    await chart.hover({ position: { x: 4, y: 64 } });
    await expect(progress.getByText(/^Mock exam 1 · /u)).toBeVisible();

    await chart.focus();
    await page.keyboard.press("End");
    await expect(chart).toHaveAttribute("aria-valuetext", /^100%: Mock exam 3 · /u);
    await page.keyboard.press("ArrowLeft");
    await expect(chart).toHaveAttribute("aria-valuetext", /^100%: Mock exam 2 · /u);

    await expectAccessibleScreen(page, "the exam page's mock progress");

    // Mocks of one subject say nothing about the whole exam yet: no estimated score, and why.
    await page.goto("/plan");

    await page
      .locator('[data-slot="journey-standing"]')
      .filter({ visible: true })
      .getByRole("button", { name: /^Preparation/u })
      .click();

    await expect(page.getByRole("dialog", { name: "Your preparation" })).toContainText(
      "Take more mock exams of the whole exam or half of it to see your estimated score.",
    );

    // A full mock is the real exam: answered questions never pad it. With every Mathematics
    // question answered and nothing more to write today, the chooser says what's ready first.
    await page.goto("/mock/new");
    await pickMock(page, /^A full exam day/u);
    await page.getByRole("button", { name: "Start" }).click();

    await expect(
      page.getByText(
        "8 of the 16 questions are ready now, so this mock takes about 12 min. More can be written for your mocks tomorrow.",
      ),
    ).toBeVisible();

    await page.getByRole("button", { name: "Start with 8 questions" }).click();
    await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();

    await expect(
      sheet.getByText("This mock asks 8 of 16 questions: there weren't enough new ones yet."),
    ).toBeVisible();

    await expect(page.getByText(/repeat/u)).toBeHidden();
    await handIn({ knows: true, number: 4 });

    await page.goto("/exam");

    await expect(
      page
        .getByRole("list", { name: "Mock exams" })
        .getByText(/A full exam day, 8 of 16 questions/u),
    ).toBeVisible();
  });

  test("come with Plus: the free plan sees each mock and what it takes", async ({ browser }) => {
    const { user } = await createAnytimeMockLearner({ plus: false });
    const page = await openAs(browser, user);

    // The exam page shows the mocks as Plus learners see them, marked Plus, with one notice, and
    // their progress over time locked.
    await page.goto("/exam");
    await expect(page.getByRole("main").getByText(/^Mock exams come with Plus/u)).toBeVisible();
    await expect(page.getByRole("link", { name: "See Plus" })).toHaveCount(1);

    await expect(page.getByRole("region", { name: "How your mocks went" })).toContainText(
      "Each mock's score over time, and how each subject is going.",
    );

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

    await expect(page.getByText("A quick check. Your first days fine-tune it.")).toBeVisible();

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
