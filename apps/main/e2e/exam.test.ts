import { randomUUID } from "node:crypto";
import { type Route } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import {
  QUOTED_STATEMENT_CITATION,
  addGradedEssay,
  addTodayMock,
  createNetScoredPracticeDay,
  playMock,
} from "./exam-fixtures";
import { createApFreeResponseDay, createSatExamAfterMock } from "./exam-scale-fixtures";
import { type Page, expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { continueToLastStep, continueToStep, nextStep } from "./result-steps";
import { askSuggestion, stubScreenTutor } from "./screen-tutor";
import { openAs } from "./study-day";

const NOT_THROUGH = "That didn't go through. Your answers are saved. Try again in a moment.";

/**
 * Holds every Server Action whose body matches, like a server that doesn't answer, until
 * `release`; later ones go through. With the page's clock run ahead, a wait shows it's bounded.
 */
async function holdServerActions(page: Page, matches: (body: string) => boolean) {
  const held: Route[] = [];
  let holding = true;

  await page.route("**/*", async (route) => {
    const request = route.request();
    const isAction = request.method() === "POST" && request.headers()["next-action"];

    if (holding && isAction && matches(request.postData() ?? "")) {
      held.push(route);
      return;
    }

    await route.fallback();
  });

  return {
    release: async () => {
      holding = false;
      await Promise.all(held.map((route) => route.abort().catch(() => null)));
    },
  };
}

test.describe("Exam goal", () => {
  test("a day, a mock in real conditions with its answer sheet, bounded waits and a tutor once handed in, its result and preparation", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      await page.goto("/today");

      const card = page.getByRole("region", { name: "Today's session" });
      await card.getByRole("button", { name: /^Continue/u }).click();
      await expect(page).toHaveURL(/\/learn\/[\w-]+\?session=[\w-]+$/u);

      const [mock, asked] = await Promise.all([
        addTodayMock({ goalId: user.goalId, userId: user.id }),
        stubScreenTutor(page),
      ]);

      // Its start (from its challenge's intro, by plan item) and hand-in are held at first: past
      // their usual time they say they're still working, and past their limit they stop waiting
      // and offer to try again.
      const isStart = (body: string) => body.includes(mock.planItemId);

      const isHandIn = (body: string) => body.includes(mock.blockId) && !body.includes("itemId");

      await page.clock.install();
      const starting = await holdServerActions(page, isStart);

      // Before it starts, the mock's own page is its challenge's intro.
      await page.goto(`/mock/${mock.blockId}`);
      await expect(page).toHaveURL(new RegExp(`/challenge/${mock.planItemId}$`, "u"));

      await expect(page.getByRole("heading", { level: 1, name: "Mock exam 1" })).toBeVisible();

      await expect(page.getByText(/only shows at the end/u)).toBeVisible();
      await expectAccessibleScreen(page, "a mock's intro");

      const start = page.getByRole("button", { name: "Start the mock exam" });
      await start.click();
      await expect(page.getByRole("button", { name: "Starting…" })).toBeDisabled();
      await page.clock.fastForward(11_000);

      await expect(
        page.getByText("Still starting. This is taking longer than usual."),
      ).toBeVisible();

      await page.clock.fastForward(35_000);
      await expect(page.getByText("That didn't go through. Try again in a moment.")).toBeVisible();

      await starting.release();
      await start.click();
      await expect(page).toHaveURL(new RegExp(`/mock/${mock.blockId}$`, "u"));

      await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
      await expect(page.getByText(/^Question 1 of \d+/u)).toBeVisible();

      // No tutor while the mock is running.
      await expect(
        page.getByRole("button", { name: "Ask Buddy about this mock exam" }),
      ).toBeHidden();

      const flag = page.getByRole("button", { name: "Flag" });
      await flag.click();
      await expect(flag).toHaveAttribute("aria-pressed", "true");

      // The answer sheet says it opens a dialog, and focus comes back to it when the dialog closes.
      const answerSheet = page.getByRole("button", { name: "Answer sheet" });
      await expect(answerSheet).toHaveAttribute("aria-haspopup", "dialog");
      await answerSheet.click();
      const sheet = page.getByRole("dialog", { name: "Answer sheet" });

      await expect(sheet.getByText(/0 answered · 1 flagged/u)).toBeVisible();
      await sheet.getByRole("button", { name: "Question 2" }).click();

      await expect(page.getByText(/^Question 2 of \d+/u)).toBeVisible();
      await expect(sheet).toBeHidden();
      await expect(answerSheet).toBeFocused();

      await page.keyboard.press("ArrowLeft");
      await expect(page.getByText(/^Question 1 of \d+/u)).toBeVisible();

      // The mock flags the first question as it's played, so the flag comes off first.
      await flag.click();
      await expect(flag).toHaveAttribute("aria-pressed", "false");

      const handingIn = await holdServerActions(page, isHandIn);
      await playMock({ answers: mock.answers, page });

      await expect(page.getByRole("button", { name: "Handing in…" })).toBeDisabled();
      await page.clock.fastForward(11_000);

      await expect(
        page.getByText("Still handing it in. This is taking longer than usual."),
      ).toBeVisible();

      await page.clock.fastForward(35_000);
      await expect(page.getByText(NOT_THROUGH)).toBeVisible();

      await handingIn.release();

      // Handing in is confirmed first, with what's still open: the question flagged as unsure.
      await page.getByRole("button", { name: "Hand in the mock exam" }).click();
      const confirm = page.getByRole("alertdialog", { name: "Hand in the mock exam?" });
      await expect(confirm.getByText(/^1 question is flagged\./u)).toBeVisible();
      await expectAccessibleScreen(page, "handing a mock in");
      await confirm.getByRole("button", { name: "Hand in" }).click();

      // The result one thing at a time. First, the score: a range labeled as an estimate, never a
      // single number.
      await expect(
        page.getByRole("heading", { level: 1, name: /^Mock exam 1 done\s*\d+–\d+$/u }),
      ).toBeVisible();

      await expect(page.getByText(/^Estimated score · /u)).toBeVisible();
      await expectAccessibleScreen(page, "a mock's result");

      // One score per area of the exam day, each named once; never the day's name for an area.
      await nextStep(page);
      await expect(page.getByRole("heading", { level: 1, name: "By area" })).toBeVisible();
      await expect(page.getByText("Matemática", { exact: true })).toBeVisible();
      await expect(page.getByText("Ciências da Natureza", { exact: true })).toBeVisible();

      await expect(
        page.getByText("Ciências da Natureza e Matemática", { exact: true }),
      ).toHaveCount(0);

      // How preparation moved, then the one thing to do now: the mistake, with the questions behind
      // a link and going on with the day as the quiet option.
      await continueToStep(page, /^\d+% → \d+%$/u);
      await expect(page.getByText("Your preparation", { exact: true })).toBeVisible();
      await continueToLastStep(page);

      await expect(
        page.getByRole("heading", { level: 1, name: "1 mistake to review" }),
      ).toBeVisible();

      await expect(page.getByRole("link", { name: "Review the mistake" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Continue today's session" })).toBeVisible();

      await page.getByRole("button", { name: "See the question" }).click();
      const review = page.getByRole("dialog", { name: "Questions to review" });
      await expect(review.getByText("Right answer")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(review).toBeHidden();

      // Once it's handed in, "Ask" is about the mock as a whole.
      await askSuggestion({
        ask: "Ask Buddy about this mock exam",
        description: "Ask questions about this mock exam",
        page,
        suggestion: "What should I practice first?",
      });

      expect(asked).toStrictEqual([
        {
          input: expect.objectContaining({ context: { kind: "mock" }, suggested: true }),
          path: `/v1/mocks/${mock.blockId}/questions`,
        },
      ]);

      // The estimate lives behind the Journey's number; the exam's page says what's on it.
      await page.goto("/journey");
      await page.locator('[data-slot="journey-hero"]').click();

      await expect(
        page
          .getByRole("dialog", { name: "Your preparation" })
          .locator('[data-slot="estimated-score"]')
          .getByText(/^\d+ to \d+$/u),
      ).toBeVisible();

      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Journey options" }).click();
      await page.getByRole("menuitem", { name: "About the exam" }).click();
      await expect(page).toHaveURL(/\/exam$/u);

      await expect(page.getByRole("heading", { level: 1, name: "About the exam" })).toBeVisible();

      await expect(
        page
          .getByRole("main")
          .getByText(/\d+ days? left/u)
          .filter({ visible: true }),
      ).toBeVisible();

      await expect(page.getByText(/^Estimated score/u)).toBeHidden();

      // The exam day by day, as its notice sets it out: each day's date and time over its parts.
      const days = page.getByRole("region", { name: "The two days" });
      await expect(days).toContainText("180 questions");
      await expect(days.getByText(/^Day 1 · November \d+(?:, \d{4})? · 5h 30m$/u)).toBeVisible();

      await expect(days.getByRole("list", { name: /^Day 1/u }).getByRole("listitem")).toHaveText([
        /^Linguagens, Ciências Humanas e redação\s*90 questions$/u,
      ]);

      await expect(page.getByRole("link", { name: /^Mock exam 1/u })).toBeVisible();
      await expectAccessibleScreen(page, "the exam page");
    });
  });

  test("an essay graded by the official rubric, with one next step and a rewrite that keeps its text when grading is slow or fails", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const essay = await addGradedEssay({ goalId: user.goalId, userId: user.id });
      // Long enough for an ENEM grade (60 words), so the send reaches grading instead of the length check.
      const draft = [
        "Minha segunda versão deixa a proposta de intervenção completa. O governo federal, por meio do Ministério da Educação,",
        "deve ampliar programas de leitura nas escolas públicas, com bibliotecas abertas no contraturno e oficinas semanais.",
        "Assim, os estudantes terão contato frequente com livros, o que melhora a escrita e a argumentação.",
        "Além disso, as famílias podem participar de encontros mensais, fortalecendo o hábito de ler em casa e na comunidade.",
      ].join(" ");

      // The first send is held, so its wait shows it's bounded; the next one reaches grading.
      await page.clock.install();
      const grading = await holdServerActions(page, (body) => body.includes(draft));
      await page.goto(`/essay/${essay.blockId}`);

      // The grade in steps: the estimated range with each criterion, the next step, the proposal's
      // missing elements, then rewriting.
      await expect(
        page.getByRole("heading", { level: 1, name: /^Your essay\s*660–740$/u }),
      ).toBeVisible();

      await expect(page.getByText("Estimated", { exact: true })).toBeVisible();

      const scores = page.getByRole("list", { name: "Score by criterion" });

      await expect(scores.getByText("Intervention proposal")).toBeVisible();
      await expectAccessibleScreen(page, "a graded essay");

      await nextStep(page);
      await expect(page.getByText("Next step", { exact: true })).toBeVisible();

      await expect(
        page.getByRole("heading", { level: 1, name: "Intervention proposal" }),
      ).toBeVisible();

      await expect(page.getByText("Say by what means the proposal will work.")).toBeVisible();
      await nextStep(page);
      await expect(page.getByText("By what means, missing")).toBeAttached();

      // Rewriting keeps the next step in view, over the draft to rework.
      await page.getByRole("button", { name: "Rewrite" }).click();
      await expect(page.getByText("Essay · ENEM rubric")).toBeVisible();
      await expect(page.getByText("Next step: Intervention proposal")).toBeVisible();

      const rewrite = page.getByLabel("Rewrite what needs work");
      await expect(rewrite).toHaveValue("Meu primeiro rascunho da redação.");

      // Typing before the page hydrates is lost, so fill until the word count React keeps follows it.
      await expect(async () => {
        await rewrite.fill(draft);
        await expect(rewrite).toHaveValue(draft, { timeout: 1000 });
        await expect(page.getByText(/^\d{2,} words$/u)).toBeVisible({ timeout: 1000 });
      }).toPass();

      // Once graded, grading the rewrite is the main action.
      const send = page.getByRole("button", { name: "Grade the rewrite" });

      const failed = page.getByText(
        "That didn't go through. Your text is still here. Try again in a moment.",
      );

      await send.click();
      await expect(page.getByRole("button", { name: "Grading…" })).toBeDisabled();
      await page.clock.fastForward(21_000);

      await expect(
        page.getByText("Still grading. This is taking longer than usual."),
      ).toBeVisible();

      await page.clock.fastForward(70_000);
      await expect(failed).toBeVisible();
      await expect(send).toBeEnabled();
      await expect(rewrite).toHaveValue(draft);

      // Tests never reach a model, so grading fails the way an outage would, and says the same.
      await grading.release();

      const graded = page.waitForResponse(
        (response) => response.request().postData()?.includes(draft) ?? false,
      );

      await send.click();
      await graded;

      await expect(failed).toBeVisible();
      await expect(send).toBeEnabled();
      await expect(rewrite).toHaveValue(draft);

      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page).not.toHaveURL(/\/essay\//u);
    });
  });

  test("a language goal for a certificate moves to an exam goal, and onboarding to its page", async ({
    page,
  }) => {
    const goal = `english for my certificate ${randomUUID().slice(0, 8)}`;

    await goalUnderstandingFixture({
      goal,
      result: {
        followUps: [],
        goals: [
          {
            kind: "language",
            level: "A2",
            nativeLanguage: "pt",
            ownLevel: "basic",
            subject: "English",
            targetDate: "2099-03-31",
            targetLanguage: "en",
            title: "Learn English",
          },
        ],
        route: "goals",
      },
    });

    await page.goto("/start");
    await page.getByRole("textbox", { name: "Your goal" }).fill(goal);
    await page.getByRole("button", { name: "Start with your goal" }).click();
    await page.getByRole("button", { name: "Looks right" }).click();

    await expect(page.getByRole("heading", { name: "Why are you learning it?" })).toBeVisible();
    const languageGoal = await prisma.goal.findFirstOrThrow({ where: { prompt: goal } });
    await expect(page).toHaveURL(new RegExp(`/start/${languageGoal.id}$`, "u"));

    await page.getByRole("textbox", { name: "Why" }).fill("Vou fazer o IELTS em março");
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    // A language certificate reports a score: that's the target onboarding asks for.
    await expect(page.getByRole("heading", { name: "What score do you need?" })).toBeVisible();

    const examGoal = await prisma.goal.findFirstOrThrow({
      where: { details: { equals: languageGoal.id, path: ["movedFromGoalId"] } },
    });

    expect(examGoal).toMatchObject({ kind: "exam", status: "active", title: "IELTS" });
    await expect(page).toHaveURL(new RegExp(`/start/${examGoal.id}$`, "u"));

    // The URL is the exam goal's own: opening it again goes on where the learner is.
    await page.reload();

    await expect(page.getByRole("heading", { name: "What score do you need?" })).toBeVisible();
  });

  test("an AP free-response answer scored by its rows' points", async ({ browser }) => {
    const { blockId, user } = await createApFreeResponseDay();
    const page = await openAs(browser, user);

    await page.goto(`/essay/${blockId}`);

    await expect(
      page.getByRole("heading", { level: 1, name: /^Your answer\s*2–4$/u }),
    ).toBeVisible();

    const scores = page.getByRole("list", { name: "Score by criterion" });
    await expect(scores.getByText("(c) Explanation")).toBeVisible();
    await expectAccessibleScreen(page, "a graded free-response answer");

    await nextStep(page);
    await expect(page.getByRole("heading", { level: 1, name: "(c) Explanation" })).toBeVisible();

    await page.getByRole("button", { name: "Rewrite" }).click();
    await expect(page.getByText("Free response · AP scoring guidelines")).toBeVisible();
    await page.context().close();
  });

  test("the SAT's estimate and result use its own scale", async ({ browser }) => {
    const { user } = await createSatExamAfterMock();
    const page = await openAs(browser, user);

    await page.goto("/exam");

    const score = page.getByLabel("Your total score (400 to 1600)");
    await expect(score).toHaveAttribute("step", "10");
    await score.fill("1350");
    await page.getByRole("button", { name: "Save my result" }).click();
    await expect(page.getByText("Result saved: 1350. Thank you for telling us.")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Result saved: 1350. Thank you for telling us.")).toBeVisible();

    // The estimate, on the exam's own scale, sits behind the Journey's number.
    await page.goto("/journey");
    await page.locator('[data-slot="journey-hero"]').click();

    await expect(
      page
        .getByRole("dialog", { name: "Your preparation" })
        .locator('[data-slot="estimated-score"]')
        .getByText("1170 to 1430", { exact: true }),
    ).toBeVisible();

    await page.context().close();
  });

  test("a Cebraspe exam's practice cites a past paper's statement, leaves statements blank and scores net", async ({
    browser,
  }) => {
    const { user } = await createNetScoredPracticeDay();
    const page = await openAs(browser, user);
    const feedback = page.getByRole("region", { name: "Answer feedback" });

    await page.goto("/session");
    await page.getByRole("button", { name: /^Start/u }).click();

    // True, right. A statement copied from a past paper cites it before and after it's answered.
    await expect(page.getByText(/^First statement/u)).toBeVisible();
    await expect(page.getByText(`Past exam question · ${QUOTED_STATEMENT_CITATION}`)).toBeVisible();

    await expect(
      page.getByText("A wrong answer cancels a right one. Not sure? Leave it blank."),
    ).toBeVisible();

    // Statements are judged right or wrong, as the exam prints them, never true or false.
    await expect(page.getByRole("button", { name: /^True/u })).toBeHidden();
    await page.getByRole("button", { name: /^Right/u }).click();
    await expect(feedback.getByText("Correct!")).toBeVisible();
    await expect(feedback.getByText(QUOTED_STATEMENT_CITATION)).toBeVisible();
    await expect(page.getByText("net 1")).toBeVisible();
    await page.keyboard.press("Enter");

    // Left blank: it cancels nothing, reads as left blank (not as a mistake) and isn't saved as one.
    await expect(page.getByText(/^Second statement/u)).toBeVisible();
    await page.getByRole("button", { name: "Leave blank" }).click();
    await expect(feedback.getByText("Left blank")).toBeVisible();
    await expect(feedback.getByText("Not quite")).toBeHidden();
    await expect(feedback.getByText(/Saved to your mistakes/u)).toBeHidden();
    await expect(page.getByText("0 wrong")).toBeVisible();
    await expect(page.getByText("net 1")).toBeVisible();

    // Coming back to the block still counts the blank as neither.
    await page.reload();
    await expect(page.getByText(/^Third statement/u)).toBeVisible();
    await expect(page.getByText("0 wrong")).toBeVisible();
    await expect(page.getByText("net 1")).toBeVisible();

    // Wrong on a right statement: the net drops back to zero.
    await page.getByRole("button", { name: /^Wrong/u }).click();
    await expect(feedback.getByText("Right answer: Right")).toBeVisible();
    await expect(page.getByText("net 0")).toBeVisible();
    await page.keyboard.press("Enter");

    // The day's only block ends on the summary, led by the net score.
    await expect(page.getByRole("heading", { level: 1, name: "Session complete" })).toBeVisible();
    await expect(page.getByText("Net score 0", { exact: true })).toBeVisible();
    await page.context().close();
  });
});
