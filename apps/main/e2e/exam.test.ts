import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import {
  addGradedEssay,
  addTodayMock,
  createNetScoredPracticeDay,
  playMock,
} from "./exam-fixtures";
import { createApFreeResponseDay, createSatExamAfterMock } from "./exam-scale-fixtures";
import { expect, test } from "./fixtures";
import { MODES, asPersona } from "./learn-personas";
import { openAs } from "./study-day";

test.describe("Exam goal", () => {
  for (const mode of MODES) {
    test(`a day, a mock in real conditions, its result and preparation in ${mode}`, async ({
      browser,
    }) => {
      await asPersona(browser, { mode, persona: "exam" }, async ({ page, user }) => {
        await page.goto("/today");
        await expect(page.getByText("Often tested").first()).toBeVisible();

        const mock = await addTodayMock({ goalId: user.goalId, userId: user.id });
        await page.goto(`/mock/${mock.blockId}`);

        await expect(
          page.getByRole("heading", {
            level: 1,
            name: mode === "fun" ? "Big Challenge" : "Mock exam 1",
          }),
        ).toBeVisible();

        await expect(page.getByText(/No feedback until the end/u)).toBeVisible();

        await page
          .getByRole("button", { name: mode === "fun" ? "I'm in" : "Start the mock exam" })
          .click();

        await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
        await expect(page.getByText(/^Question 1 of \d+/u)).toBeVisible();

        await playMock({ answers: mock.answers, page });

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

        await page.goto("/progress");

        await expect(
          page.getByText(
            mode === "fun" ? /^Estimated \d+ to \d+$/u : /^Estimated score: \d+ to \d+$/u,
          ),
        ).toBeVisible();

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
      });
    });
  }

  test("the mock's answer sheet jumps between questions and shows flags", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page, user }) => {
      const mock = await addTodayMock({ goalId: user.goalId, userId: user.id });

      await page.goto(`/mock/${mock.blockId}`);
      await page.getByRole("button", { name: "Start the mock exam" }).click();
      await page.getByRole("button", { name: "Flag" }).click();

      await expect(page.getByRole("button", { name: "Flag" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      // The button says it opens a dialog, and focus comes back to it when the dialog closes.
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
    });
  });

  for (const mode of MODES) {
    test(`an essay graded by the official rubric, with one next step, in ${mode}`, async ({
      browser,
    }) => {
      await asPersona(browser, { mode, persona: "exam" }, async ({ page, user }) => {
        const essay = await addGradedEssay({ goalId: user.goalId, userId: user.id });

        await page.goto(`/essay/${essay.blockId}`);

        await expect(page.getByText("Essay · ENEM rubric")).toBeVisible();
        await expect(page.getByRole("heading", { name: "Your essay" })).toBeVisible();
        await expect(page.getByText("660–740")).toBeVisible();
        await expect(page.getByText("Estimated", { exact: true })).toBeVisible();

        const scores = page.getByRole("list", { name: "Score by criterion" });

        await expect(scores.getByText("Intervention proposal")).toBeVisible();
        await expect(page.getByText("Next step: Intervention proposal")).toBeVisible();
        await expect(page.getByText("By what means, missing")).toBeAttached();

        await expect(page.getByLabel("Rewrite what needs work")).toHaveValue(
          "Meu primeiro rascunho da redação.",
        );

        await page.getByRole("button", { name: "Continue" }).click();
        await expect(page).not.toHaveURL(/\/essay\//u);
      });
    });
  }

  test("a grade that fails keeps the text and offers another try", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page, user }) => {
      const essay = await addGradedEssay({ goalId: user.goalId, userId: user.id });
      // Long enough for an ENEM grade (60 words), so the send reaches grading instead of the length check.
      const draft = [
        "Minha segunda versão deixa a proposta de intervenção completa. O governo federal, por meio do Ministério da Educação,",
        "deve ampliar programas de leitura nas escolas públicas, com bibliotecas abertas no contraturno e oficinas semanais.",
        "Assim, os estudantes terão contato frequente com livros, o que melhora a escrita e a argumentação.",
        "Além disso, as famílias podem participar de encontros mensais, fortalecendo o hábito de ler em casa e na comunidade.",
      ].join(" ");

      await page.goto(`/essay/${essay.blockId}`);
      const rewrite = page.getByLabel("Rewrite what needs work");

      // Typing before the page hydrates is lost, so fill until the word count React keeps follows it.
      await expect(async () => {
        await rewrite.fill(draft);
        await expect(rewrite).toHaveValue(draft, { timeout: 1000 });
        await expect(page.getByText(/^\d{2,} words$/u)).toBeVisible({ timeout: 1000 });
      }).toPass();

      // Tests never reach a model, so grading fails the way an outage would.
      await page.getByRole("button", { name: "Send for grading" }).click();

      await expect(
        page.getByText("That didn't go through. Your text is still here. Try again in a moment."),
      ).toBeVisible();

      await expect(page.getByRole("button", { name: "Send for grading" })).toBeEnabled();
      await expect(rewrite).toHaveValue(draft);
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

  for (const mode of MODES) {
    test(`an AP free-response answer scored by its rows' points, in ${mode}`, async ({
      browser,
    }) => {
      const { blockId, user } = await createApFreeResponseDay(mode);
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
      await page.context().close();
    });
  }

  for (const mode of MODES) {
    test(`the SAT's estimate and result use its own scale, in ${mode}`, async ({ browser }) => {
      const { user } = await createSatExamAfterMock(mode);
      const page = await openAs(browser, user);

      await page.goto("/exam");
      await expect(page.getByText("Estimated score: 1170 to 1430")).toBeVisible();

      const score = page.getByLabel("Your total score (400 to 1600)");
      await expect(score).toHaveAttribute("step", "10");
      await score.fill("1350");
      await page.getByRole("button", { name: "Save my result" }).click();
      await expect(page.getByText("Result saved: 1350. Thank you for telling us.")).toBeVisible();

      // The result keeps the estimate it's compared with, so estimates can be checked against it.
      await expect
        .poll(() => prisma.examResult.findFirst({ where: { userId: user.id } }))
        .toMatchObject({ estimateHigh: 1430, estimateLow: 1170, scale: "sat", score: 1350 });

      await page.reload();
      await expect(page.getByText("Result saved: 1350. Thank you for telling us.")).toBeVisible();

      await page.goto("/progress");

      await expect(
        page.getByText(
          mode === "fun" ? "Estimated 1170 to 1430" : "Estimated score: 1170 to 1430",
          { exact: true },
        ),
      ).toBeVisible();

      await page.context().close();
    });
  }

  for (const mode of MODES) {
    test(`a Cebraspe exam's practice leaves statements blank and scores net, in ${mode}`, async ({
      browser,
    }) => {
      const { user } = await createNetScoredPracticeDay(mode);
      const page = await openAs(browser, user);
      const feedback = page.getByRole("region", { name: "Answer feedback" });

      await page.goto("/session");
      await page.getByRole("button", { name: /^Start/u }).click();

      // True, right.
      await expect(page.getByText(/^First statement/u)).toBeVisible();

      await expect(
        page.getByText("A wrong answer cancels a right one. Not sure? Leave it blank."),
      ).toBeVisible();

      // Statements are judged right or wrong, as the exam prints them, never true or false.
      await expect(page.getByRole("button", { name: /^True/u })).toBeHidden();
      await page.getByRole("button", { name: /^Right/u }).click();
      await expect(feedback.getByText("Correct!")).toBeVisible();
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
  }
});
