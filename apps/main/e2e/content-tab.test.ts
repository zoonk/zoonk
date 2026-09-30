import { randomUUID } from "node:crypto";
import { type Browser } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { type Page, expect, test } from "./fixtures";
import { type Mode, asPersona } from "./learn-personas";

const CARD_COUNT = 1000;
const AREA_COUNT = 40;
const GOLD_EVERY = 4;

/** A chapter row opens with this many cards; "Show all" reveals the rest. */
const FIRST_CARDS = 12;

/**
 * A learner whose goal has a thousand skills over forty chapters, a quarter of them gold. Built
 * with bulk writes, so the test measures the screen rather than the setup.
 */
async function createThousandCardLearner(browser: Browser, mode: Mode) {
  const user = await createE2EUser(getBaseURL());
  const goal = await goalFixture({ title: "A thousand ideas", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });
  const run = randomUUID();

  const chapters = await Promise.all(
    Array.from({ length: AREA_COUNT }, (_, index) =>
      libraryChapterFixture({ title: `Area ${index + 1}` }),
    ),
  );

  const skills = Array.from({ length: CARD_COUNT }, (_, index) => ({
    description: `Idea number ${index + 1} in one sentence`,
    example: `Example for idea ${index + 1}`,
    id: randomUUID(),
    identityKey: `e2e-cards-${run}-${index}`,
    language: "en",
    model: "test/fixture-model",
    name: `Card ${index + 1}`,
    normalizedName: `card ${index + 1}`,
    promptVersion: "test-v1",
    runId: run,
  }));

  await prisma.skill.createMany({ data: skills });

  await Promise.all([
    prisma.planItem.createMany({
      data: skills.map((skill, position) => ({
        chapterId: chapters[position % AREA_COUNT]?.id ?? null,
        kind: "lesson" as const,
        phase: 0,
        planId: plan.id,
        position,
        skillId: skill.id,
        titleSnapshot: skill.name,
      })),
    }),
    prisma.learnerSkill.createMany({
      data: skills
        .filter((_, index) => index % GOLD_EVERY === 0)
        .map((skill) => ({
          lastReviewedAt: new Date(),
          recallDays: 3,
          reps: 4,
          skillId: skill.id,
          stability: 60,
          state: "mastered" as const,
          userId: user.id,
        })),
    }),
    learningProfileFixture({ activeGoalId: goal.id, experienceMode: mode, userId: user.id }),
    learningEventFixture({ kind: "review", userId: user.id }),
  ]);

  const context = await browser.newContext({ storageState: user.storageState });
  return { context, page: await context.newPage() };
}

function searchBox(page: Page) {
  return page.getByRole("searchbox", { name: "Search skills" });
}

test.describe("Content tab", () => {
  test("groups the exam's skills by area, then chapter", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page }) => {
      await page.goto("/content");

      const math = page.getByRole("heading", { level: 2, name: "Matemática" });
      const sciences = page.getByRole("heading", { level: 2, name: "Ciências da Natureza" });

      await expect(math).toBeVisible();
      await expect(sciences).toBeVisible();

      // Each area's chapters sit under it, Math's before Natural Sciences starts.
      const percentages = page.getByText("Porcentagem", { exact: true }).first();
      await expect(percentages).toBeVisible();

      const [mathBox, percentagesBox, sciencesBox] = await Promise.all([
        math.boundingBox(),
        percentages.boundingBox(),
        sciences.boundingBox(),
      ]);

      expect(mathBox?.y ?? 0).toBeLessThan(percentagesBox?.y ?? 0);
      expect(percentagesBox?.y ?? 0).toBeLessThan(sciencesBox?.y ?? 0);
    });
  });

  test("Focus lists the skills with their states, search, filters and summaries", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page }) => {
      await page.goto("/content");

      await expect(page.getByRole("heading", { level: 1, name: "Skills" })).toBeVisible();

      const filters = page.getByRole("group", { name: "Show" });

      await expect(filters.getByRole("button", { name: /All/u })).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      // Focus names the gold state Mastered, as its skill list does.
      await filters.getByRole("button", { name: /Mastered/u }).click();
      await expect(page.getByRole("listitem").filter({ hasText: "Mastered" })).toHaveCount(1);
      await expect(page.getByRole("listitem").filter({ hasText: "Solid" })).toHaveCount(0);

      await filters.getByRole("button", { name: /All/u }).click();
      await searchBox(page).fill("desconto");
      await expect(page.getByText("Calcular o preço com desconto")).toBeVisible();
      await expect(page.getByText("Brasil República")).toBeHidden();
    });
  });

  test("Fun shows Cards that flip, with today's capsules first", async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "fun" }, async ({ page }) => {
      await page.goto("/content");

      await expect(page.getByRole("heading", { level: 1, name: "Cards" })).toBeVisible();
      await expect(page.getByText(/capsules? opens? today/u)).toBeVisible();
      const openCapsules = page.getByRole("link", { exact: true, name: "Open" });
      await expect(openCapsules).toHaveAttribute("href", "/today");

      await page
        .getByRole("group", { name: "Show" })
        .getByRole("button", { name: /Gold/u })
        .click();

      const card = page.getByRole("button", { pressed: false }).filter({ hasText: "gold" });
      await expect(card).toHaveCount(1);
      await card.click();

      await expect(page.getByRole("button", { name: /back of the card$/u })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });

  test("cards filter and flip from the keyboard", async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "fun" }, async ({ page }) => {
      await page.goto("/content");

      const gold = page.getByRole("group", { name: "Show" }).getByRole("button", { name: /Gold/u });
      await gold.focus();
      await page.keyboard.press("Enter");
      await expect(gold).toHaveAttribute("aria-pressed", "true");

      const card = page.getByRole("button", { pressed: false }).filter({ hasText: "gold" });
      await card.focus();
      await page.keyboard.press("Enter");

      await expect(page.getByRole("button", { name: /back of the card$/u })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });

  test("Show all by keyboard moves focus to the first card it revealed", async ({ browser }) => {
    const { context, page } = await createThousandCardLearner(browser, "fun");

    try {
      await page.goto("/content");

      // Only the first chapter opens, with its first twelve cards.
      const cards = page.getByRole("button", { name: /^Card \d+$/u });
      await expect(cards).toHaveCount(FIRST_CARDS);

      const showAll = page.getByRole("button", { name: `Show all ${CARD_COUNT / AREA_COUNT}` });
      await showAll.focus();
      await page.keyboard.press("Enter");

      await expect(showAll).toBeHidden();
      await expect(cards).toHaveCount(CARD_COUNT / AREA_COUNT);
      await expect(cards.nth(FIRST_CARDS)).toBeFocused();
    } finally {
      await context.close();
    }
  });

  test("a thousand cards stay quick to open, search and filter", async ({ browser }) => {
    const { context, page } = await createThousandCardLearner(browser, "fun");

    try {
      const start = Date.now();
      await page.goto("/content");

      await expect(page.getByText("1,000 cards in 40 areas")).toBeVisible();

      expect(Date.now() - start).toBeLessThan(10_000);

      const filters = page.getByRole("group", { name: "Show" });
      await expect(filters.getByRole("button", { name: /1,000\s*All/u })).toBeVisible();

      await expect(filters.getByRole("button", { name: /250\s*Gold/u })).toBeVisible();

      const searchStart = Date.now();
      await searchBox(page).fill("Card 999");
      await expect(page.getByText("Card 999", { exact: true })).toBeVisible();
      await expect(page.getByText("Card 998", { exact: true })).toBeHidden();
      expect(Date.now() - searchStart).toBeLessThan(3000);
    } finally {
      await context.close();
    }
  });
});
