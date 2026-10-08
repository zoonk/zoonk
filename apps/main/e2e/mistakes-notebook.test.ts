import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { TRAP, createMistakeLearner, drillQuestion } from "./mistake-drill-days";
import { openAs } from "./study-day";

/**
 * Ana's mistakes notebook: how many are left to fix with "Practice mistakes" under it, then one
 * row per skill that opens in place to each mistake with why it happened, and the fixed ones on
 * their own page.
 */
test.describe("Mistakes notebook", () => {
  test("leads with what's left to fix, opens each skill's mistakes in place, and shows the fixed ones", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page }) => {
      await page.goto("/mistakes");

      await expect(page.getByRole("heading", { level: 1, name: "3 to fix" })).toBeVisible();
      await expect(page.getByText("Mistakes notebook", { exact: true })).toBeVisible();

      // The notebook sits under the Journey, where its row is, and its way back is the Journey.
      await expect(
        page
          .getByRole("navigation", { name: "Learning tabs" })
          .getByRole("link", { exact: true, name: "Today" }),
      ).toHaveAttribute("aria-current", "page");

      // The notebook opens from Today's "Practice anytime", which is the way back.
      await expect(
        page.getByRole("main").getByRole("link", { name: "Back to Today" }),
      ).toHaveAttribute("href", "/today");

      await expect(page.getByRole("link", { name: "Practice mistakes" })).toHaveAttribute(
        "href",
        "/mistakes/practice",
      );

      await expectAccessibleScreen(page, "the mistakes notebook");

      // Each skill is one row with its count; its mistakes wait behind it.
      const entries = page.locator('[data-slot="mistake-entry"]');
      const shirt = entries.filter({ hasText: "Uma camisa de" });
      const discount = page.locator("summary").filter({ hasText: "Calcular o preço com desconto" });
      await expect(discount).toContainText("1");
      await expect(shirt).toBeHidden();

      // A row opens from the keyboard, and each mistake says why it happened.
      await discount.focus();
      await page.keyboard.press("Enter");
      await expect(shirt).toContainText("Misread");
      await expect(shirt).toContainText("You answered: R$ 18");
      await expect(shirt).toContainText("Right answer: R$ 102");

      await page.locator("summary").filter({ hasText: "Combinar variações percentuais" }).click();

      await expect(entries.filter({ hasText: "Um investidor aplicou" })).toContainText(
        "Fell for a trap",
      );

      await page.locator("summary").filter({ hasText: "Resolver circuitos em série" }).click();

      await expect(entries.filter({ hasText: "Uma lanterna usa" })).toContainText("Content gap");

      await page.getByRole("link", { name: "See fixed mistakes" }).click();
      await expect(page).toHaveURL(/\/mistakes\?status=fixed$/u);
      await expect(page.getByRole("heading", { level: 1, name: "1 fixed" })).toBeVisible();

      // A notebook with one skill opens it.
      await expect(entries.filter({ hasText: "Fixed" })).toHaveCount(1);
      await expect(entries.filter({ hasText: "Fixed" })).toBeVisible();

      await page.getByRole("main").getByRole("link", { name: "Mistakes notebook" }).click();
      await expect(page).toHaveURL(/\/mistakes$/u);
    });
  });

  test("practice drills a mistake by its cause and gives the why, by keyboard", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const attemptsBefore = await prisma.attempt.count({ where: { userId: user.id } });
      const right = page.getByRole("status").filter({ hasText: /^Right!/u });

      await page.goto("/mistakes");
      await expect(page.getByRole("heading", { level: 1, name: "3 to fix" })).toBeVisible();
      await page.getByRole("link", { name: "Practice mistakes" }).click();

      await expect(page.getByText("Read every word before you answer.")).toBeVisible();

      // The mistake's own question (a number to type) can't be asked here, so its earlier
      // answer stays out: next to another question it would mislead.
      await expect(page.getByText(/^Last time you answered/u)).toBeHidden();

      // A misread is drilled by reading first: the answers show once the question is read.
      await expect(page.getByRole("button", { name: "R$ 2.040" })).toBeHidden();

      // Keys work once the page hydrates, so the first press retries. Enter shows the answers of
      // a question read first, then a number picks; picking again is harmless.
      await expect(async () => {
        await page.keyboard.press("Enter");
        await page.keyboard.press("2");

        await expect(page.getByRole("button", { name: "R$ 2.040", pressed: true })).toBeVisible({
          timeout: 1000,
        });
      }).toPass({ timeout: 5000 });

      // Enter checks, then goes on.
      await page.keyboard.press("Enter");
      await expect(right).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(right).toBeHidden();

      await expect
        .poll(async () => prisma.attempt.count({ where: { userId: user.id } }))
        .toBe(attemptsBefore + 1);
    });
  });

  test("practice counts toward today, stopped early too", async ({ browser }) => {
    const { user } = await createMistakeLearner({ causes: ["trap", "guess"] });
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

    // What the run did, as chips, with one way back.
    const facts = done.getByRole("listitem");
    await expect(facts).toHaveText(["1 mistake fixed", "1 of 1 right", "+2 Brain Power"]);

    await expectAccessibleScreen(page, "a practice's end");
    await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute("href", /\/mistakes$/u);

    await expect
      .poll(() =>
        prisma.learningEvent.findMany({
          select: { brainPower: true, correctAnswers: true },
          where: { lessonKind: "mistakePractice", userId: user.id },
        }),
      )
      .toStrictEqual([{ brainPower: 2, correctAnswers: 1 }]);

    await expect
      .poll(() => prisma.dailyProgress.findFirst({ where: { userId: user.id } }))
      .toMatchObject({ brainPowerEarned: 2, correctAnswers: 1, interactiveCompleted: 1 });

    await page.goto("/stats");

    // The overview's Activity card (the sidebar, on a wide screen, names the page alone).
    await expect(page.getByRole("main").getByRole("link", { name: /^Activity 1 day/u })).toHaveText(
      /^Activity\s*1 day/u,
    );

    await page.context().close();
  });

  test("sends a signed-out visitor of practice to sign in", async ({ page }) => {
    const authUrls: string[] = [];

    // Central auth is stood in for: only where the learner is sent matters here.
    await page.route("**/auth/login**", async (route) => {
      authUrls.push(route.request().url());
      await route.fulfill({ body: "Auth app", contentType: "text/html", status: 200 });
    });

    await page.goto("/mistakes/practice");
    await expect.poll(() => authUrls.length).toBe(1);
    await expect(page.getByText("Start with a goal")).toBeHidden();
  });

  test("reports a practice question while its keys wait", async ({ browser }) => {
    const { user } = await createMistakeLearner({ causes: ["guess"] });
    const page = await openAs(browser, user);
    const answer = page.getByRole("button", { name: "Right answer" });

    await page.goto("/mistakes/practice");

    await expect(
      page.getByRole("heading", { name: drillQuestion("guess", "original") }),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "I'm not sure" })).toBeVisible();

    // Full screen like a lesson: the task's header, no tabs.
    await expect(page.getByRole("heading", { level: 1, name: "Practice mistakes" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Learning tabs" })).toBeHidden();
    await expect(page.getByRole("progressbar", { name: /^Question 1 of \d+$/u })).toBeVisible();
    await expectAccessibleScreen(page, "practice mistakes");

    // The menu opens from the keyboard, and a number key pressed in it picks no answer.
    await page.getByRole("button", { name: "Question options" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("1");
    await expect(answer).toHaveAttribute("aria-pressed", "false");

    // The menu only reports a problem: no votes in the middle of a practice.
    await expect(page.getByRole("menuitemcheckbox")).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Report a problem" }).press("Enter");
    const dialog = page.getByRole("dialog", { name: "Report a problem" });
    await expect(dialog.getByText("This screen is attached")).toBeVisible();

    // A number key pressed while the form is open picks nothing underneath it either.
    await page.keyboard.press("1");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(answer).toHaveAttribute("aria-pressed", "false");

    // Once the form is closed and focus is back on the menu's button, number keys answer again.
    await expect(page.getByRole("button", { name: "Question options" })).toBeFocused();
    await page.keyboard.press("1");
    await expect(answer).toHaveAttribute("aria-pressed", "true");
    await page.context().close();
  });
});
