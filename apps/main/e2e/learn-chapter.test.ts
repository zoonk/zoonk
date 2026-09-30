import { prisma } from "@zoonk/db";
import { type Page, expect, test } from "./fixtures";
import { MODES, asPersona, findPlanChapterId } from "./learn-personas";

/**
 * A chapter of Maya's plan (quantum physics from scratch): she's in "Exponents and scientific
 * notation", the fourth chapter of the math phase, with "Powers of ten" done and an open mistake.
 */
const CHAPTER = "Exponents and scientific notation";

async function openChapter(page: Page, goalId: string) {
  await page.goto(`/content/chapters/${await findPlanChapterId(goalId, CHAPTER)}`);
  await expect(page.getByRole("heading", { level: 1, name: CHAPTER })).toBeVisible();
}

test.describe("Chapter page", () => {
  for (const mode of MODES) {
    test(`shows the chapter's map, lessons and mistakes in ${mode}`, async ({ browser }) => {
      await asPersona(browser, { mode, persona: "hugeGoal" }, async ({ page, user }) => {
        await openChapter(page, user.goalId);

        await expect(page.getByText("Chapter 4 · Beginner")).toBeVisible();
        await expect(page.getByRole("progressbar", { name: /of 3 lessons/u })).toBeVisible();

        const lessons = page.getByRole("region", { name: "Lessons" });
        await expect(lessons.getByRole("link", { name: /Done Powers of ten/u })).toBeVisible();
        await expect(lessons.getByRole("link", { name: /^Next /u })).toBeVisible();
        await expect(lessons.getByRole("img", { name: "Coming up" })).toBeVisible();

        const map = page.getByRole("list", { name: `Skills in ${CHAPTER}` });
        // Screen readers hear each skill's state and what it builds on, as the lines show.
        await expect(
          map.getByRole("button", {
            name: "Write a number in scientific notation Learning, builds on Use powers of ten",
          }),
        ).toBeVisible();

        const powers = map.getByRole("button", { name: /^Use powers of ten/u });
        await powers.click();

        await expect(powers).toHaveAttribute("aria-expanded", "true");
        const detail = page.getByRole("region", { name: "Use powers of ten" });
        await expect(detail.getByRole("link", { name: "Powers of ten" })).toBeVisible();

        await expect(page.getByRole("link", { name: "Your mistakes" })).toHaveAttribute(
          "href",
          /\/mistakes$/u,
        );

        await expect(page.getByText("1 to review")).toBeVisible();
      });
    });
  }

  test("walks the map with the keyboard", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "hugeGoal" }, async ({ page, user }) => {
      await openChapter(page, user.goalId);

      const skills = page.getByRole("list", { name: `Skills in ${CHAPTER}` }).getByRole("button");
      await skills.first().focus();
      await page.keyboard.press("ArrowRight");
      await expect(skills.nth(1)).toBeFocused();

      await page.keyboard.press("Enter");
      await expect(skills.nth(1)).toHaveAttribute("aria-expanded", "true");

      await page.keyboard.press("Escape");
      await expect(skills.nth(1)).toHaveAttribute("aria-expanded", "false");
    });
  });

  for (const mode of MODES) {
    test(`practices the chapter's skills in today's session in ${mode}`, async ({ browser }) => {
      await asPersona(browser, { mode, persona: "hugeGoal" }, async ({ page, user }) => {
        await openChapter(page, user.goalId);

        await page.getByRole("button", { name: "Practice" }).click();

        // Practice on the chapter's studied skills, or its next lesson once today's session has
        // already asked every question on them.
        await expect(page).toHaveURL(/\/(?:session|learn\/[^/?]+\?session=)/u);
      });
    });

    test(`saves a vote on the chapter from its menu in ${mode}`, async ({ browser }) => {
      await asPersona(browser, { mode, persona: "hugeGoal" }, async ({ page, user }) => {
        const chapterId = await findPlanChapterId(user.goalId, CHAPTER);
        await openChapter(page, user.goalId);

        await page.getByRole("button", { name: "Chapter options" }).click();
        await page.getByRole("menuitemcheckbox", { exact: true, name: "Not helpful" }).click();

        const sheet = page.getByRole("dialog", { name: "What went wrong?" });
        await sheet.getByRole("button", { name: "Too easy" }).click();
        await sheet.getByRole("button", { name: "Send" }).click();
        await expect(sheet).toBeHidden();

        await expect
          .poll(() =>
            prisma.contentFeedback.findFirst({ where: { contentId: chapterId, userId: user.id } }),
          )
          .toMatchObject({ contentKind: "chapter", mode, reasons: ["tooEasy"], vote: "down" });
      });
    });
  }

  test("hides chapters that aren't in the learner's plan", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "hugeGoal" }, async ({ page }) => {
      const outside = await prisma.chapter.findFirstOrThrow({
        where: { title: "Light: wave or particle?" },
      });

      await page.goto(`/content/chapters/${outside.id}`);
      await expect(page.getByRole("heading", { name: "We couldn't find this page" })).toBeVisible();
    });
  });
});

test.describe("Plan links", () => {
  test("Focus links the current phase's chapters, the map and the full course", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "focus", persona: "hugeGoal" }, async ({ page }) => {
      await page.goto("/plan");

      await expect(page.getByText(/^\d+ of \d+ chapters · See full course$/u)).toBeVisible();

      await expect(page.getByRole("link", { name: "See full course" })).toHaveAttribute(
        "href",
        /\/b\/[^/]+\/c\/[^/]+$/u,
      );

      await page.getByRole("link", { exact: true, name: CHAPTER }).click();
      await expect(page.getByRole("heading", { level: 1, name: CHAPTER })).toBeVisible();
    });
  });

  test("Fun's route leads to the map, where the subject's levels are", async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "fun" }, async ({ page }) => {
      await page.goto("/plan");
      await expect(page.getByRole("heading", { level: 1, name: "Route" })).toBeVisible();

      await page.getByRole("link", { name: "See the map of your subject" }).click();
      const mapTitle = page.getByRole("heading", { level: 1, name: "Map of your subject" });
      await expect(mapTitle).toBeVisible();

      const levels = page.getByRole("region", { name: "Levels of this subject" });
      const planLevel = levels.getByRole("listitem").filter({ hasText: "your plan" });

      await expect(planLevel).toHaveText(/^Overview/u);
      await expect(page.getByText("Want to go deeper later? Just keep going.")).toBeVisible();
    });
  });
});
