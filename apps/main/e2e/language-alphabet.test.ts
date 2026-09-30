import { getAlphabetIdentityKey } from "@zoonk/core/library/language/alphabet-identity";
import { prisma } from "@zoonk/db";
import { alphabetLessonFixture } from "@zoonk/testing/fixtures/language";
import { type Page, expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

/** The script the learner starts on: Japanese hiragana, whose letters aren't Latin. */
const SCRIPT = {
  letters: [
    ["あ", "a"],
    ["か", "ka"],
  ],
  target: "ja",
  title: "Seu primeiro hiragana",
} as const;

type Script = typeof SCRIPT;

/** Marcos's goal now targets a language whose script isn't Latin, with its alphabet lesson written. */
async function learnNewScript({ goalId, script }: { goalId: string; script: Script }) {
  await prisma.goal.update({ data: { targetLanguage: script.target }, where: { id: goalId } });

  return alphabetLessonFixture({
    identityKey: getAlphabetIdentityKey(script.target),
    targetLanguage: script.target,
  });
}

/** Reads the intro and the letter cards (only the first has a clip), then matches them. */
async function playAlphabetLesson(page: Page, script: Script) {
  const [[first, firstReading], [second, secondReading]] = script.letters;
  const next = page.getByRole("button", { name: /^Next/u });

  await expect(page.getByText("Um som por letra")).toBeVisible();
  await next.click();

  const firstCard = page.getByRole("region", { name: `Alphabet: ${first}` });
  await expect(firstCard.getByText(firstReading, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play pronunciation" })).toBeVisible();
  await next.click();

  await expect(page.getByRole("region", { name: `Alphabet: ${second}` })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play pronunciation" })).toBeHidden();
  await next.click();

  await expect(page.getByText("Match the pairs.")).toBeVisible();

  for (const label of [first, firstReading, second, secondReading]) {
    // oxlint-disable-next-line no-await-in-loop -- A pair is matched by tapping its sides in turn.
    await page.getByRole("button", { exact: true, name: label }).click();
  }

  // Matching gives feedback pair by pair, so Check moves straight on.
  await page.getByRole("button", { name: /^Check/u }).click();
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  await expect(page.getByText("Você já lê 2 letras.")).toBeVisible();
}

/**
 * A language whose script isn't Latin starts with its alphabet: Content lists the lesson first
 * while it still opens the sessions, "I can already read it" skips it, and the lesson stays open
 * as practice, with each letter's sound and a match.
 */
test.describe("Alphabet intro", () => {
  test("lists the alphabet first, skips it and plays it as practice", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "language" }, async ({ page, user }) => {
      const lesson = await learnNewScript({ goalId: user.goalId, script: SCRIPT });
      await page.goto("/content");

      const units = page.getByRole("navigation", { name: "Units" });
      const row = units.getByRole("link", { name: new RegExp(SCRIPT.title, "u") });
      const skip = units.getByRole("button", { name: "I can already read it" });

      await expect(row).toContainText("First in your next session · 5 min");
      await skip.click();

      await expect(row).toContainText("Practice anytime · 5 min");
      await expect(skip).toBeHidden();

      await expect
        .poll(async () => {
          const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
          return goal.details;
        })
        .toMatchObject({ alphabetIntro: "skipped" });

      await row.click();
      await expect(page).toHaveURL(new RegExp(`/learn/${lesson.id}$`, "u"));
      await playAlphabetLesson(page, SCRIPT);
    });
  });
});
