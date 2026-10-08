import { getAlphabetIdentityKey } from "@zoonk/core/library/language/alphabet-identity";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { alphabetLessonFixture } from "@zoonk/testing/fixtures/language";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

/** The script the learner starts on: Japanese hiragana, whose letters aren't Latin. */
const SCRIPT = { target: "ja", title: "Seu primeiro hiragana" } as const;

/** Marcos's goal now targets a language whose script isn't Latin, with its alphabet lesson written. */
async function learnNewScript(goalId: string) {
  await prisma.goal.update({ data: { targetLanguage: SCRIPT.target }, where: { id: goalId } });

  return alphabetLessonFixture({
    identityKey: getAlphabetIdentityKey(SCRIPT.target),
    targetLanguage: SCRIPT.target,
  });
}

/**
 * A language whose script isn't Latin starts with its alphabet: the Journey shows the lesson above
 * its path while it still opens the sessions, "I can already read it" skips it, and the lesson
 * stays open as practice.
 */
test.describe("Alphabet intro", () => {
  test("lists the alphabet first, skips it and opens it as practice", async ({ browser }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      const lesson = await learnNewScript(user.goalId);
      await page.goto("/journey");

      const row = page.getByRole("link", { name: new RegExp(SCRIPT.title, "u") });
      const skip = page.getByRole("button", { name: "I can already read it" });

      await expect(row).toContainText("First in your next session · 5 min");
      await expectAccessibleScreen(page, "the Journey for a language goal");
      await skip.click();

      // The row reads the saved skip back from the server.
      await expect(row).toContainText("Practice anytime · 5 min");
      await expect(skip).toBeHidden();

      await row.click();
      await expect(page).toHaveURL(new RegExp(`/learn/${lesson.id}$`, "u"));
      await expect(page.getByText("Um som por letra")).toBeVisible();
    });
  });
});
