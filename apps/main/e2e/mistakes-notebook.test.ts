import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { TRAP, createMistakeLearner, drillQuestion } from "./mistake-drill-days";
import { openAs } from "./study-day";

/**
 * Ana's mistakes notebook: open mistakes by skill with why they happened, filters by cause, the
 * fixed ones, and "Practice mistakes", which drills each by its cause. Split between Focus and Fun.
 */
test.describe("Mistakes notebook", () => {
  test("shows mistakes by skill and filters by cause", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page }) => {
      await page.goto("/mistakes");

      await expect(
        page.getByRole("heading", { level: 1, name: "Mistakes notebook" }),
      ).toBeVisible();

      await expect(page.getByText(/^3 to fix · 1 fixed$/u)).toBeVisible();

      await expect(
        page.getByRole("heading", { name: "Calcular o preço com desconto" }),
      ).toBeVisible();

      const causes = page.getByRole("navigation", { name: "Filter by cause" });
      await causes.getByRole("link", { name: /Misread/u }).click();

      await expect(page).toHaveURL(/cause=misread/u);

      await expect(page.getByRole("listitem").filter({ hasText: "You answered:" })).toHaveCount(1);

      await expect(page.getByText("Right answer: R$ 102")).toBeVisible();

      await page.goto("/mistakes");
      await page.getByRole("link", { name: "See fixed mistakes" }).click();
      await expect(page.getByRole("listitem").filter({ hasText: "Fixed" })).toHaveCount(1);
    });
  });

  test("practice drills a mistake by its cause and gives the why", async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "exam" }, async ({ page, user }) => {
      const attemptsBefore = await prisma.attempt.count({ where: { userId: user.id } });

      await page.goto("/mistakes");
      await page.getByRole("link", { name: "Practice mistakes" }).click();

      await expect(page.getByText("Read every word before you answer.")).toBeVisible();
      await expect(page.getByText("Last time you answered: R$ 18")).toBeVisible();

      // A misread is drilled by reading first: the answers show once the question is read.
      await expect(page.getByRole("button", { name: "R$ 2.040" })).toBeHidden();
      await page.getByRole("button", { name: /^I've read it\. Show the answers/u }).click();

      await page.getByRole("button", { name: "R$ 2.040" }).click();
      await page.getByRole("button", { name: "Check" }).click();

      await expect(page.getByRole("status").filter({ hasText: /^Right!/u })).toBeVisible();
      await page.getByRole("button", { name: "Continue" }).click();

      await expect
        .poll(async () => prisma.attempt.count({ where: { userId: user.id } }))
        .toBe(attemptsBefore + 1);
    });
  });

  test("practice by keyboard: a number picks, Enter checks and goes on", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page }) => {
      await page.goto("/mistakes/practice");
      await expect(page.getByText("Read every word before you answer.")).toBeVisible();

      // Keys work once the page hydrates, so the first press retries. Enter shows the answers of
      // a question read first, then a number picks; picking again is harmless.
      await expect(async () => {
        await page.keyboard.press("Enter");
        await page.keyboard.press("2");

        await expect(page.getByRole("button", { name: "R$ 2.040", pressed: true })).toBeVisible({
          timeout: 1000,
        });
      }).toPass({ timeout: 5000 });

      await page.keyboard.press("Enter");
      await expect(page.getByRole("status").filter({ hasText: /^Right!/u })).toBeVisible();

      await page.keyboard.press("Enter");
      await expect(page.getByRole("status").filter({ hasText: /^Right!/u })).toBeHidden();
    });
  });

  test("practice counts toward today, stopped early too", async ({ browser }) => {
    const { user } = await createMistakeLearner({ causes: ["trap", "guess"], mode: "fun" });
    const page = await openAs(browser, user);

    await page.goto("/activity");
    await expect(page.getByText(/start learning to track your progress/iu)).toBeVisible();

    await page.goto("/mistakes/practice");

    await expect(
      page.getByText("There's a trap in here. Find it before you answer."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Right answer" }).click();
    await page.getByRole("button", { name: /^Check/u }).click();

    // A trap drill names the trap after the answer, a right one included.
    await expect(page.getByRole("status").filter({ hasText: /^Right!/u })).toBeVisible();
    await expect(page.getByText(TRAP)).toBeVisible();

    await page.getByRole("button", { name: "End practice. What you answered counts." }).click();

    const done = page.getByRole("status").filter({ hasText: "Practice done" });
    await expect(done.getByRole("heading", { level: 1, name: "Practice done" })).toBeVisible();

    await expect(done.getByText("1 mistake fixed. The rest come back another day.")).toBeVisible();

    await expect(done.getByText("+2", { exact: true })).toBeVisible();
    await expect(done.getByText("Brain Power")).toBeVisible();
    await expect(done.getByText("Practice time")).toBeVisible();
    await expect(done.getByText("1 of 1", { exact: true })).toBeVisible();

    await expect
      .poll(() =>
        prisma.learningEvent.findMany({
          select: { brainPower: true, correctAnswers: true, mode: true },
          where: { lessonKind: "mistakePractice", userId: user.id },
        }),
      )
      .toStrictEqual([{ brainPower: 2, correctAnswers: 1, mode: "fun" }]);

    await expect
      .poll(() => prisma.dailyProgress.findFirst({ where: { userId: user.id } }))
      .toMatchObject({ brainPowerEarned: 2, correctAnswers: 1, interactiveCompleted: 1 });

    await page.goto("/activity");
    await expect(page.getByRole("article", { name: /learning days/iu })).toContainText("1 day");
    await page.context().close();
  });

  test("votes on a practice question while its keys wait", async ({ browser }) => {
    const { drills, user } = await createMistakeLearner({ causes: ["guess"], mode: "focus" });
    const page = await openAs(browser, user);
    const answer = page.getByRole("button", { name: "Right answer" });

    await page.goto("/mistakes/practice");

    await expect(
      page.getByRole("heading", { name: drillQuestion("guess", "original") }),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "I'm not sure" })).toBeVisible();

    // The menu opens from the keyboard, and a number key pressed in it picks no answer.
    await page.getByRole("button", { name: "Question options" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("1");
    await expect(answer).toHaveAttribute("aria-pressed", "false");

    await page.getByRole("menuitemcheckbox", { exact: true, name: "Not helpful" }).press("Enter");
    const sheet = page.getByRole("dialog", { name: "What went wrong?" });
    await expect(sheet).toBeVisible();

    await expect
      .poll(() =>
        prisma.contentFeedback.findFirst({
          select: { contentKind: true, mode: true, vote: true },
          where: { contentId: drills[0]?.original.id, userId: user.id },
        }),
      )
      .toStrictEqual({ contentKind: "item", mode: "focus", vote: "down" });

    // A number key pressed while the sheet is open picks nothing underneath it either.
    await page.keyboard.press("1");
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(answer).toHaveAttribute("aria-pressed", "false");

    // Once the sheet is closed, number keys answer again.
    await page.keyboard.press("1");
    await expect(answer).toHaveAttribute("aria-pressed", "true");
    await page.context().close();
  });
});
