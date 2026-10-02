import { getAlphabetIdentityKey } from "@zoonk/core/library/language/alphabet-identity";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { alphabetLessonFixture } from "@zoonk/testing/fixtures/language";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

/** The script the learner starts on: Japanese hiragana, whose letters aren't Latin. */
const SCRIPT = { target: "ja", title: "Seu primeiro hiragana" } as const;

/**
 * Marcos's goal now targets a language whose script isn't Latin, with its alphabet lesson written.
 * He also picked a buddy once, in Fun.
 */
async function learnNewScript({ goalId, userId }: { goalId: string; userId: string }) {
  await Promise.all([
    prisma.goal.update({ data: { targetLanguage: SCRIPT.target }, where: { id: goalId } }),
    learningProfileFixture({ buddyKind: "zu", userId }),
  ]);

  return alphabetLessonFixture({
    identityKey: getAlphabetIdentityKey(SCRIPT.target),
    targetLanguage: SCRIPT.target,
  });
}

/**
 * A language whose script isn't Latin starts with its alphabet: Content lists the lesson first
 * while it still opens the sessions, "I can already read it" skips it, and the lesson stays open
 * as practice, without a buddy in Focus.
 */
test.describe("Alphabet intro", () => {
  test("lists the alphabet first, skips it and opens it as practice", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "language" }, async ({ page, user }) => {
      const lesson = await learnNewScript({ goalId: user.goalId, userId: user.id });
      await page.goto("/content");

      const units = page.getByRole("navigation", { name: "Units" });
      const row = units.getByRole("link", { name: new RegExp(SCRIPT.title, "u") });
      const skip = units.getByRole("button", { name: "I can already read it" });

      await expect(row).toContainText("First in your next session · 5 min");
      await expectAccessibleScreen(page, "Content for a language goal");
      await skip.click();

      // The row reads the saved skip back from the server.
      await expect(row).toContainText("Practice anytime · 5 min");
      await expect(skip).toBeHidden();

      await row.click();
      await expect(page).toHaveURL(new RegExp(`/learn/${lesson.id}$`, "u"));
      await expect(page.getByText("Um som por letra")).toBeVisible();

      // The buddy stays on the profile, but whether a lesson has one is the page's call: Focus
      // plays it without the buddy's first line.
      await expect(page.getByText("Ready when you are.")).toHaveCount(0);
    });
  });
});
