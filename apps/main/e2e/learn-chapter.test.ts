import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { studySessionBlockFixture } from "@zoonk/testing/fixtures/study-sessions";
import { expect, test } from "./fixtures";
import { asPersona, findPlanChapterId } from "./learn-personas";
import { askSuggestion, stubScreenTutor } from "./screen-tutor";

/**
 * A chapter of Maya's plan (quantum physics from scratch): she's in "Exponents and scientific
 * notation", the fourth chapter of the math phase, with "Powers of ten" done and an open mistake.
 */
const CHAPTER = "Exponents and scientific notation";

const EXTRA = { equals: true, path: ["extra"] };

/** The day's bonus practice played out: the block "Practice now" added, then a second one. */
async function useUpBonusPractice(goalId: string) {
  const added = await prisma.studySessionBlock.findFirstOrThrow({
    orderBy: { createdAt: "desc" },
    where: { payload: EXTRA, session: { goalId } },
  });

  const last = await prisma.studySessionBlock.findFirstOrThrow({
    orderBy: { position: "desc" },
    where: { sessionId: added.sessionId },
  });

  await Promise.all([
    prisma.studySessionBlock.update({ data: { status: "completed" }, where: { id: added.id } }),
    studySessionBlockFixture({
      kind: "practice",
      payload: { areaId: "bonus-second", extra: true, itemIds: [], skillIds: [] },
      position: last.position + 1,
      sessionId: added.sessionId,
      status: "completed",
    }),
  ]);

  return added.sessionId;
}

test.describe("Chapter page", () => {
  test("shows the chapter's lessons, mistakes and skills, takes a report and a question, and practices it up to the day's cap", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page, user }) => {
      const [chapterId, outside, asked] = await Promise.all([
        findPlanChapterId(user.goalId, CHAPTER),
        prisma.chapter.findFirstOrThrow({ where: { title: "Light: wave or particle?" } }),
        stubScreenTutor(page),
      ]);

      const chapterUrl = new RegExp(`/content/chapters/${chapterId}$`, "u");

      // Chapters open from the Journey, which is the way back.
      await page.goto(`/content/chapters/${chapterId}`);
      await expect(page.getByRole("heading", { level: 1, name: CHAPTER })).toBeVisible();

      await expect(
        page.getByRole("main").getByRole("link", { name: "Back to Journey" }),
      ).toHaveAttribute("href", "/journey");

      await expect(page.getByText("Chapter 4", { exact: true })).toBeVisible();
      // Its one way in, with how far she is in it, right under its name.
      await expect(page.getByRole("link", { name: /^Continue\s*33% complete$/u })).toHaveAttribute(
        "href",
        /\/learn\/[\da-f-]{36}$/u,
      );

      // Every lesson opens in the player, in teaching order, the next one marked.
      const lessons = page.getByRole("region", { name: "Lessons" });
      await expect(lessons.getByText("1 of 3", { exact: true })).toBeVisible();
      await expect(lessons.getByRole("link")).toHaveCount(3);

      await expect(lessons.getByRole("link", { name: /^Up next \d+\. /u })).toHaveAttribute(
        "href",
        /\/learn\/[\da-f-]{36}$/u,
      );

      await expect(
        lessons.getByRole("link", { name: /^Done \d+\. Powers of ten/u }),
      ).toHaveAttribute("href", /\/learn\/[\da-f-]{36}$/u);

      await expect(lessons.getByRole("link", { name: /^Coming up \d+\. /u })).toHaveAttribute(
        "href",
        /\/learn\/[\da-f-]{36}$/u,
      );

      await expectAccessibleScreen(page, "a chapter");

      // Folded away in its summary: each skill with its state in words.
      const summary = page.getByRole("button", { name: "Chapter summary" });
      await expect(summary).toHaveAttribute("aria-expanded", "false");
      await summary.click();

      const skills = page.getByRole("region", { name: "Skills" });

      await expect(
        skills.getByRole("listitem").filter({ hasText: "Write a number in scientific notation" }),
      ).toHaveText(/^Write a number in scientific notation\s*Learning$/u);

      // She knows none of it yet, so the test that skips it is there.
      await expect(page.getByText("Already know this?")).toBeVisible();
      await expect(page.getByRole("button", { name: "Take the test" })).toBeEnabled();

      // Its menu only reports a problem: no votes on a chapter.
      await page.getByRole("button", { name: "Chapter options" }).click();
      await expect(page.getByRole("menuitem", { name: "Report a problem" })).toBeVisible();
      await expect(page.getByRole("menuitemcheckbox")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toBeHidden();

      // "Ask" is about the chapter as a whole, and closing it hands focus back to it.
      const tutor = await askSuggestion({
        ask: "Ask Buddy about this chapter",
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

      await expect(
        page.getByRole("button", { name: "Ask Buddy about this chapter" }),
      ).toBeFocused();

      // Her open mistake is on this chapter's skills: practice adds a bonus block on them, or
      // opens its next lesson once today's session has already asked every question on them.
      await expect(page.getByText("1 from this chapter", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Practice now" }).click();
      await expect(page).toHaveURL(/\/(?:session|learn\/[^/?]+\?session=)/u);

      // Bonus practice stops at two blocks a day: after both, the tap says so and adds none.
      const sessionId = await useUpBonusPractice(user.goalId);
      await page.goto(`/content/chapters/${chapterId}`);
      await page.getByRole("button", { name: "Practice now" }).click();

      await expect(
        page.getByRole("status").filter({ hasText: "That's all the bonus practice for today." }),
      ).toBeVisible();

      await expect(page).toHaveURL(chapterUrl);

      await expect(
        prisma.studySessionBlock.count({ where: { payload: EXTRA, sessionId } }),
      ).resolves.toBe(2);

      // A chapter outside the learner's plan isn't hers to open.
      await page.goto(`/content/chapters/${outside.id}`);
      await expect(page.getByRole("heading", { name: "We couldn't find this page" })).toBeVisible();
    });
  });
});
