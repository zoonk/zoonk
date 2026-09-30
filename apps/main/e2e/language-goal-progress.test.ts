import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

const RENTING_UNIT = "Alugando um apartamento";

/**
 * Marcos's English goal (a language goal) on Progress and Today: level by skill against his
 * target, "I can already…", the words he knows and the last four weeks, the current situation and
 * the pattern noticed in his mistakes. Progress keeps the sections every goal shares and leaves
 * preparation out.
 */
test.describe("Language goal progress", () => {
  test(`Progress shows level by skill, "I can already" and the last four weeks`, async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "focus", persona: "language" }, async ({ page }) => {
      await page.goto("/progress");

      const levels = page.getByRole("list", { name: "Level by skill" });

      await expect(levels.getByRole("listitem")).toHaveText([
        /^Reading\s*B1$/u,
        /^Listening\s*B1/u,
        /^Speaking\s*A2\+/u,
        /^Writing\s*A2\+/u,
      ]);

      await expect(
        levels
          .getByRole("listitem")
          .filter({ hasText: "Listening" })
          .getByLabel("up since the level test"),
      ).toBeVisible();

      await expect(page.getByText(/^Goal B1\+ by \w+ \d{4}$/u)).toBeVisible();
      await expect(page.getByText("Listening went up to B1 since the level test.")).toBeVisible();

      const canDo = page.getByRole("region", { name: "I can already…" });
      await expect(canDo.getByText("Consigo pedir informações no aeroporto")).toBeVisible();
      await expect(canDo.getByText("Consigo marcar uma visita, not yet")).toBeVisible();

      await expect(page.getByText(/^9\s*words known$/u)).toBeVisible();

      const recent = page.getByRole("region", { name: "In the last 4 weeks" });
      await expect(recent).toContainText("9new words");
      await expect(recent).toContainText("1conversation");

      const situation = page.getByRole("region", { name: "Your current situation" });
      await expect(situation.getByText("Unit 2 of 6")).toBeVisible();
      await expect(situation.getByRole("link", { name: RENTING_UNIT })).toBeVisible();

      await expect(page.getByRole("link", { name: /Mistakes notebook/u })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Your stats" })).toBeVisible();
      await expect(page.getByText(/preparation$/u)).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "IELTS speaking mock" })).toHaveCount(0);
    });
  });

  test("Progress offers the speaking mock to a goal preparing for IELTS", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "language" }, async ({ page, user }) => {
      await prisma.goal.update({
        data: { prompt: "I need English for Toronto and the IELTS in March" },
        where: { id: user.goalId },
      });

      await page.goto("/progress");

      await expect(page.getByRole("heading", { name: "IELTS speaking mock" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Start the mock" })).toBeEnabled();
    });
  });

  test("Progress offers the TOEFL speaking mock to a goal preparing for the TOEFL", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "fun", persona: "language" }, async ({ page, user }) => {
      await prisma.goal.update({
        data: { prompt: "I need English for grad school and the TOEFL in May" },
        where: { id: user.goalId },
      });

      await page.goto("/progress");

      await expect(page.getByRole("heading", { name: "TOEFL speaking mock" })).toBeVisible();

      await expect(
        page.getByText(/^Repeat sentences, then a short interview with an examiner/u),
      ).toBeVisible();

      await expect(page.getByRole("heading", { name: "IELTS speaking mock" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Start the mock" })).toBeEnabled();
    });
  });

  for (const exam of ["IELTS", "TOEFL"]) {
    test(`the exam screen keeps the speaking mock once the goal moved to the ${exam}`, async ({
      browser,
    }) => {
      await asPersona(browser, { mode: "focus", persona: "language" }, async ({ page, user }) => {
        await prisma.goal.update({
          data: { kind: "exam", title: exam },
          where: { id: user.goalId },
        });

        await page.goto("/exam");

        await expect(page.getByRole("heading", { name: `${exam} speaking mock` })).toBeVisible();

        await expect(page.getByRole("button", { name: "Start the mock" })).toBeEnabled();
      });
    });
  }

  test("Today shows the current situation and the noticed pattern", async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "language" }, async ({ page }) => {
      await page.goto("/today");

      const situation = page.getByRole("region", { name: "Your current situation" });
      await expect(situation.getByText("Unit 2 of 6")).toBeVisible();
      await expect(situation.getByText("1 of 4 lessons")).toBeVisible();

      await expect(
        page.getByRole("link", { name: /We noticed a pattern\s*since e for/u }),
      ).toBeVisible();

      await situation.getByRole("link", { name: RENTING_UNIT }).click();

      await expect(page).toHaveURL(/\/content\/units\/[\da-f-]{36}$/u);
      await expect(page.getByRole("heading", { level: 1, name: RENTING_UNIT })).toBeVisible();
    });
  });
});
