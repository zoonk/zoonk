import { prisma } from "@zoonk/db";
import { expectAccessibleRoutes, expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { expect, test } from "./fixtures";
import { asPersona, findPlanChapterId } from "./learn-personas";
import { askSuggestion, stubScreenTutor } from "./screen-tutor";

/**
 * A chapter of Maya's plan (quantum physics from scratch): she's in "Exponents and scientific
 * notation", the fourth chapter of the math phase, with "Powers of ten" done and an open mistake.
 */
const CHAPTER = "Exponents and scientific notation";

test.describe("Chapter page", () => {
  test("opens from the plan with the chapter's map, lessons and mistakes, takes a vote and a question, and practices it", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "focus", persona: "hugeGoal" }, async ({ page, user }) => {
      const [chapterId, outside, asked] = await Promise.all([
        findPlanChapterId(user.goalId, CHAPTER),
        prisma.chapter.findFirstOrThrow({ where: { title: "Light: wave or particle?" } }),
        stubScreenTutor(page),
      ]);

      // Focus's plan links the current phase's chapters and the full course.
      await page.goto("/plan");
      await expect(page.getByText(/^\d+ of \d+ chapters · See full course$/u)).toBeVisible();

      await expect(page.getByRole("link", { name: "See full course" })).toHaveAttribute(
        "href",
        /\/b\/[^/]+\/c\/[^/]+$/u,
      );

      await page.getByRole("link", { exact: true, name: CHAPTER }).click();
      await expect(page).toHaveURL(new RegExp(`/content/chapters/${chapterId}$`, "u"));
      await expect(page.getByRole("heading", { level: 1, name: CHAPTER })).toBeVisible();

      await expect(page.getByText("Chapter 4 · Beginner")).toBeVisible();
      await expect(page.getByRole("progressbar", { name: /of 3 lessons/u })).toBeVisible();

      const lessons = page.getByRole("region", { name: "Lessons" });
      await expect(lessons.getByRole("link", { name: /Done Powers of ten/u })).toBeVisible();
      await expectAccessibleScreen(page, "a chapter");
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

      // The map is walked with the keyboard too.
      const skills = map.getByRole("button");
      await skills.first().focus();
      await page.keyboard.press("ArrowRight");
      await expect(skills.nth(1)).toBeFocused();

      await page.keyboard.press("Enter");
      await expect(skills.nth(1)).toHaveAttribute("aria-expanded", "true");

      await page.keyboard.press("Escape");
      await expect(skills.nth(1)).toHaveAttribute("aria-expanded", "false");

      await expect(page.getByRole("link", { name: "Your mistakes" })).toHaveAttribute(
        "href",
        /\/mistakes$/u,
      );

      await expect(page.getByText("1 to review")).toBeVisible();

      // A vote on the chapter from its menu is saved with its reason.
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
        .toMatchObject({
          contentKind: "chapter",
          mode: "focus",
          reasons: ["tooEasy"],
          vote: "down",
        });

      // "Ask" is about the chapter as a whole, and closing it hands focus back to it.
      const tutor = await askSuggestion({
        ask: "Ask about this chapter",
        description: "Ask questions about this chapter",
        page,
        suggestion: "What will I be able to do after this chapter?",
      });

      expect(asked).toStrictEqual([
        {
          input: expect.objectContaining({
            context: { kind: "chapter" },
            question: "What will I be able to do after this chapter?",
            suggested: true,
          }),
          path: `/v1/chapters/${chapterId}/questions`,
        },
      ]);

      await page.keyboard.press("Escape");
      await expect(tutor).toBeHidden();
      await expect(page.getByRole("button", { name: "Ask about this chapter" })).toBeFocused();

      // Practice on the chapter's studied skills, or its next lesson once today's session has
      // already asked every question on them.
      await page.getByRole("button", { name: "Practice" }).click();
      await expect(page).toHaveURL(/\/(?:session|learn\/[^/?]+\?session=)/u);

      // A chapter outside the learner's plan isn't hers to open.
      await page.goto(`/content/chapters/${outside.id}`);
      await expect(page.getByRole("heading", { name: "We couldn't find this page" })).toBeVisible();
    });
  });
});

test.describe("Plan links", () => {
  test("Fun's route leads to the map, where the subject's levels are", async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "fun" }, async ({ page, user }) => {
      await page.goto("/plan");
      await expect(page.getByRole("heading", { level: 1, name: "Route" })).toBeVisible();

      await page.getByRole("link", { name: "See the map of your subject" }).click();
      const mapTitle = page.getByRole("heading", { level: 1, name: "Map of your subject" });
      await expect(mapTitle).toBeVisible();

      const levels = page.getByRole("region", { name: "Levels of this subject" });
      const planLevel = levels.getByRole("listitem").filter({ hasText: "your plan" });

      await expect(planLevel).toHaveText(/^Overview/u);
      await expect(page.getByText("Want to go deeper later? Just keep going.")).toBeVisible();
      await expectAccessibleScreen(page, "the map of the subject");

      // No Fun flow opens a chapter's page, so it's scanned here.
      const chapter = await prisma.planItem.findFirstOrThrow({
        where: { chapterId: { not: null }, plan: { goalId: user.goalId } },
      });

      await expectAccessibleRoutes(page, [{ path: `/content/chapters/${chapter.chapterId}` }]);
    });
  });
});
