import { prisma } from "@zoonk/db";
import { openPaletteWithKeyboard } from "./command-palette";
import { expect, test } from "./fixtures";
import { createDrillSession } from "./mistake-drill-days";
import { openAs, saveMissions } from "./study-day";

test.describe("Mistake mission availability", () => {
  test("today's mistakes return tomorrow without an empty practice, a ready badge or a practice shortcut", async ({
    browser,
  }) => {
    const learner = await createDrillSession({ causes: ["misread"] });

    await prisma.mistake.update({
      data: { createdAt: new Date() },
      where: { id: learner.drills[0]!.mistake.id },
    });

    const page = await openAs(browser, learner.user);

    try {
      await page.setViewportSize({ height: 844, width: 390 });
      await page.goto("/today");

      // No new lesson or review is planned, and this mistake only becomes available tomorrow.
      // Zero achievable missions leave out the missions card and its reward.
      await expect(page.getByRole("region", { name: "Today's missions" })).toHaveCount(0);

      await expect(
        page.getByRole("link", { name: /^Mistakes notebook/u }).filter({ visible: true }),
      ).toContainText("Today's mistakes return tomorrow");

      // On a desktop, the sidebar and the palette name the notebook without a ready badge or a
      // practice shortcut.
      await page.setViewportSize({ height: 900, width: 1440 });
      const sidebar = page.getByRole("complementary", { name: "Sidebar" });
      const notebook = sidebar.getByRole("link", { name: /^Mistakes notebook/u });
      await expect(notebook).toHaveText("Mistakes notebook");

      await openPaletteWithKeyboard(page, /Search/u);
      const palette = page.getByRole("dialog", { name: /Search/u });

      await expect(palette.getByRole("option", { name: /^Practice your mistakes/u })).toHaveCount(
        0,
      );

      await expect(palette.getByRole("option", { name: /^Mistakes notebook/u })).toHaveText(
        "Mistakes notebook",
      );

      await page.keyboard.press("Escape");
      await expect(notebook).toHaveText("Mistakes notebook");
      await notebook.click();
      await expect(page.getByText("1 available tomorrow · 0 fixed", { exact: true })).toBeVisible();

      await expect(
        page.getByText("Mistakes come back for practice from the day after you make them.", {
          exact: true,
        }),
      ).toBeVisible();

      await expect(page.getByText("Practice tomorrow", { exact: true })).toBeVisible();

      await expect(page.getByRole("link", { exact: true, name: "Practice mistakes" })).toHaveCount(
        0,
      );

      await expect(
        page.getByRole("link", { exact: true, name: "Practice this skill" }),
      ).toHaveCount(0);
    } finally {
      await page.context().close();
    }
  });

  test("a mission to fix three mistakes opens the notebook's practice", async ({ browser }) => {
    const learner = await createDrillSession({ causes: ["misread"] });

    await saveMissions(learner.session.id, [
      {
        anchor: {},
        detail: { count: 6 },
        kind: "fixMistake",
        opens: { kind: "mistakesPractice" },
        total: 3,
      },
    ]);

    const page = await openAs(browser, learner.user);

    try {
      await page.setViewportSize({ height: 844, width: 390 });
      await page.goto("/today");

      const missions = page.getByRole("region", { name: "Today's missions" });
      await expect(missions).toContainText("0/1");

      const fix = missions.getByRole("link", { name: /^Fix 3 mistakes, practice your mistakes$/u });

      await expect(fix).toHaveAccessibleDescription(
        /^0 of 3\s·\sFrom your mistakes notebook\s·\s~6\smin$/u,
      );

      await expect(fix).toHaveAttribute("href", "/mistakes/practice");
      await fix.click();

      await expect(page).toHaveURL(/\/mistakes\/practice$/u);

      await expect(
        page.getByRole("heading", { exact: true, name: "misread first question?" }),
      ).toBeVisible();
    } finally {
      await page.context().close();
    }
  });

  test("the fix mission recognizes notebook mistakes outside today's planned drills", async ({
    browser,
  }) => {
    const learner = await createDrillSession({ causes: ["misread"] });

    await prisma.studySessionBlock.updateMany({
      data: {
        payload: {
          itemIds: [learner.drills[0]!.original.id, learner.drills[0]!.extra.id],
          skillIds: [learner.drills[0]!.skill.id],
        },
      },
      where: { sessionId: learner.session.id },
    });

    const page = await openAs(browser, learner.user);

    try {
      await page.setViewportSize({ height: 844, width: 390 });
      await page.goto("/today");

      await expect(
        page
          .getByRole("region", { name: "Today's missions" })
          .getByRole("link", { name: /^Fix a mistake\b/u }),
      ).toBeVisible();

      await page
        .getByRole("link", { name: /^Mistakes notebook/u })
        .filter({ visible: true })
        .click();

      await expect(page.getByText("1 ready to practice · 0 fixed", { exact: true })).toBeVisible();

      await expect(
        page.getByRole("link", { exact: true, name: "Practice mistakes" }),
      ).toBeVisible();

      await page.getByRole("link", { exact: true, name: "Practice this skill" }).click();

      await expect(
        page.getByRole("heading", { exact: true, name: "misread first question?" }),
      ).toBeVisible();
    } finally {
      await page.context().close();
    }
  });
});
