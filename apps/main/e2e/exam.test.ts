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
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page, user }) => {
      await page.goto("/today");
      await expect(page.getByText("Often tested").first()).toBeVisible();

      const card = page.getByRole("region", { name: "Today's session" });
      await card.getByRole("button", { name: /^Continue/u }).click();
      await expect(page).toHaveURL(/\/learn\/[\w-]+\?session=[\w-]+$/u);

      const [mock, asked] = await Promise.all([
        addTodayMock({ goalId: user.goalId, userId: user.id }),
        stubScreenTutor(page),
      ]);

      // Its start and hand-in are held at first: past their usual time they say they're still
      // working, and past their limit they stop waiting and offer to try again.
      const isStartOrHandIn = (body: string) =>
        body.includes(mock.blockId) && !body.includes("itemId");

      await page.clock.install();
      const starting = await holdServerActions(page, isStartOrHandIn);
      await page.goto(`/mock/${mock.blockId}`);

      await expect(page.getByRole("heading", { level: 1, name: "Mock exam 1" })).toBeVisible();

      await expect(page.getByText(/No feedback until the end/u)).toBeVisible();
      await expectAccessibleScreen(page, "a mock's intro");

      const start = page.getByRole("button", { name: "Start the mock exam" });
      await start.click();
      await expect(page.getByRole("button", { name: "Starting…" })).toBeDisabled();
      await page.clock.fastForward(11_000);

      await expect(
        page.getByText("Still starting. This is taking longer than usual."),
      ).toBeVisible();

      await page.clock.fastForward(35_000);
      await expect(page.getByText(NOT_THROUGH)).toBeVisible();

      await starting.release();
      await start.click();

      await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
      await expect(page.getByText(/^Question 1 of \d+/u)).toBeVisible();

      // No tutor while the mock is running.
      await expect(page.getByRole("button", { name: "Ask about this mock exam" })).toBeHidden();

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

      const handingIn = await holdServerActions(page, isStartOrHandIn);
      await playMock({ answers: mock.answers, page });

      await expect(page.getByRole("button", { name: "Handing in…" })).toBeDisabled();
      await page.clock.fastForward(11_000);

      await expect(
        page.getByText("Still handing it in. This is taking longer than usual."),
      ).toBeVisible();

      await page.clock.fastForward(35_000);
      await expect(page.getByText(NOT_THROUGH)).toBeVisible();

      await handingIn.release();
      await page.getByRole("button", { name: "Hand in the mock exam" }).click();

      await expect(page.getByRole("heading", { level: 1, name: "Mock exam 1" })).toBeVisible();

      // A mock's score is a range labeled Estimated, never a single number.
      await expect(page.getByText(/^\d+–\d+$/u).first()).toBeVisible();
      await expect(page.getByText("Estimated", { exact: true })).toBeVisible();

      // One score per area of the exam day, each named once; never the day's name for an area.
      await expect(page.getByText("Matemática", { exact: true })).toBeVisible();
      await expect(page.getByText("Ciências da Natureza", { exact: true })).toBeVisible();

      await expect(
        page.getByText("Ciências da Natureza e Matemática", { exact: true }),
      ).toHaveCount(0);

      await expect(page.getByText("What the mock exam showed")).toBeVisible();
      await expect(page.getByText("Timing")).toBeVisible();

      // Once it's handed in, "Ask" is about the mock as a whole.
      await askSuggestion({
        ask: "Ask about this mock exam",
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

      await page.goto("/progress");

      await expect(page.getByText(/^Estimated score: \d+ to \d+$/u)).toBeVisible();
      await expectAccessibleScreen(page, "Progress");

      await page.getByRole("link", { name: /^Your exam/u }).click();
      await expect(page).toHaveURL(/\/exam$/u);

      await expect(page.getByRole("heading", { name: "What's on the exam" })).toBeVisible();

      // Every ENEM area is asked a lot, so the tag marks topics inside an area, not the areas.
      await expect(page.getByText("Appears a lot").first()).toBeHidden();

      const maths = page
        .getByRole("listitem")
        .filter({ has: page.getByText("Matemática e suas Tecnologias", { exact: true }) });

      await maths.getByText("Matemática e suas Tecnologias", { exact: true }).click();
      await expect(maths.getByText("Appears a lot").first()).toBeVisible();
      await expect(page.getByRole("link", { name: /^Mock exam 1/u })).toBeVisible();
      await expectAccessibleScreen(page, "the exam page");
    });
  });

  test("an essay graded by the official rubric, with one next step and a rewrite that keeps its text when grading is slow or fails", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "fun", persona: "exam" }, async ({ page, user }) => {
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

      await expect(page.getByText("Essay · ENEM rubric")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Your essay" })).toBeVisible();
      await expect(page.getByText("660–740")).toBeVisible();
      await expect(page.getByText("Estimated", { exact: true })).toBeVisible();

      const scores = page.getByRole("list", { name: "Score by criterion" });

      await expect(scores.getByText("Intervention proposal")).toBeVisible();
      await expect(page.getByText("Next step: Intervention proposal")).toBeVisible();
      await expect(page.getByText("By what means, missing")).toBeAttached();
      await expectAccessibleScreen(page, "a graded essay");

      const rewrite = page.getByLabel("Rewrite what needs work");
      await expect(rewrite).toHaveValue("Meu primeiro rascunho da redação.");

      // Typing before the page hydrates is lost, so fill until the word count React keeps follows it.
      await expect(async () => {
        await rewrite.fill(draft);
        await expect(rewrite).toHaveValue(draft, { timeout: 1000 });
        await expect(page.getByText(/^\d{2,} words$/u)).toBeVisible({ timeout: 1000 });
      }).toPass();

      const send = page.getByRole("button", { name: "Send for grading" });

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

    await expect(page.getByRole("heading", { name: "What are you aiming for?" })).toBeVisible();

    const examGoal = await prisma.goal.findFirstOrThrow({
      where: { details: { equals: languageGoal.id, path: ["movedFromGoalId"] } },
    });

    expect(examGoal).toMatchObject({ kind: "exam", status: "active", title: "IELTS" });
    await expect(page).toHaveURL(new RegExp(`/start/${examGoal.id}$`, "u"));

    // The URL is the exam goal's own: opening it again goes on where the learner is.
    await page.reload();
    await expect(page.getByRole("heading", { name: "What are you aiming for?" })).toBeVisible();
  });

  test("an AP free-response answer scored by its rows' points", async ({ browser }) => {
    const { blockId, user } = await createApFreeResponseDay("focus");
    const page = await openAs(browser, user);

    await page.goto(`/essay/${blockId}`);

    await expect(page.getByText("Free response · AP scoring guidelines")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your answer" })).toBeVisible();

    await expect(
      page.getByText("Scored like the AP scoring guidelines, out of 6 points"),
    ).toBeVisible();

    await expect(page.getByText("2–4")).toBeVisible();

    const scores = page.getByRole("list", { name: "Score by criterion" });
    await expect(scores.getByText("(c) Explanation")).toBeVisible();
    await expect(scores.getByText("Total 3 of 6")).toBeVisible();
    await expect(page.getByText("Next step: (c) Explanation")).toBeVisible();
    await expectAccessibleScreen(page, "a graded free-response answer");
    await page.context().close();
  });

  test("the SAT's estimate and result use its own scale", async ({ browser }) => {
    const { user } = await createSatExamAfterMock("fun");
    const page = await openAs(browser, user);

    await page.goto("/exam");
    await expect(page.getByText("Estimated score: 1170 to 1430")).toBeVisible();
    await expectAccessibleScreen(page, "the exam page");

    const score = page.getByLabel("Your total score (400 to 1600)");
    await expect(score).toHaveAttribute("step", "10");
    await score.fill("1350");
    await page.getByRole("button", { name: "Save my result" }).click();
    await expect(page.getByText("Result saved: 1350. Thank you for telling us.")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Result saved: 1350. Thank you for telling us.")).toBeVisible();

    await page.goto("/progress");

    await expect(page.getByText("Estimated 1170 to 1430", { exact: true })).toBeVisible();

    await page.context().close();
  });

  test("a Cebraspe exam's practice cites a past paper's statement, leaves statements blank and scores net", async ({
    browser,
  }) => {
    const { user } = await createNetScoredPracticeDay("focus");
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

    // Left blank: it cancels nothing.
    await expect(page.getByText(/^Second statement/u)).toBeVisible();
    await page.getByRole("button", { name: "Leave blank" }).click();
    await expect(feedback).toBeVisible();
    await expect(page.getByText("0 wrong")).toBeVisible();
    await expect(page.getByText("net 1")).toBeVisible();
    await page.keyboard.press("Enter");

    // Wrong on a right statement: the net drops back to zero.
    await expect(page.getByText(/^Third statement/u)).toBeVisible();
    await page.getByRole("button", { name: /^Wrong/u }).click();
    await expect(feedback.getByText("Right answer: Right")).toBeVisible();
    await expect(page.getByText("net 0")).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(page.getByText("Net score 0: 1 right, 1 wrong")).toBeVisible();
    await page.context().close();
  });
});
