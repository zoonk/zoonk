import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { pronunciationReviewFixture } from "@zoonk/testing/fixtures/pronunciation-reviews";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

/** Two words Marcos mispronounced, due to be said again today. */
async function seedDueWords(userId: string) {
  const organization = await aiOrganizationFixture();
  const suffix = crypto.randomUUID().slice(0, 6);

  const [rent, deposit] = await Promise.all(
    [`rent${suffix}`, `deposit${suffix}`].map((word) =>
      wordFixture({ organizationId: organization.id, targetLanguage: "en", word }),
    ),
  );

  if (!rent || !deposit) {
    throw new Error("Words weren't created");
  }

  await prisma.wordPronunciation.create({
    data: {
      pronunciation: "RÉNT",
      tip: "Em inglês, o r do começo não soa como h.",
      userLanguage: "pt",
      wordId: rent.id,
    },
  });

  await Promise.all([
    pronunciationReviewFixture({ dueAt: new Date(Date.now() - 60_000), userId, wordId: rent.id }),
    pronunciationReviewFixture({ userId, wordId: deposit.id }),
  ]);

  return { deposit, rent };
}

/**
 * Words a language learner mispronounced come back as "Say it again" on Today: each one with its
 * respelling, tip and native sound, said out loud or skipped. Grading the sound calls a paid
 * model, so it's covered by core's integration tests; here the microphone is refused.
 */
test.describe("Pronunciation reviews", () => {
  test("opens the due words from Today and walks through them", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "language" }, async ({ page, user }) => {
      const { deposit, rent } = await seedDueWords(user.id);

      await page.goto("/today");

      const row = page.getByRole("link", { name: /Say 2 words again/u });
      await expect(row).toContainText(`${rent.word} and ${deposit.word}`);
      await row.click();

      await expect(page).toHaveURL(/\/pronunciation\?goal=[\da-f-]{36}$/u);
      await expect(page.getByText("Word 1 of 2")).toBeVisible();

      const card = page.getByRole("region", { name: "The word to say" });
      await expect(card.getByText(rent.word, { exact: true })).toBeVisible();
      await expect(card).toContainText("Say it like RÉNT");
      await expect(card).toContainText("Em inglês, o r do começo não soa como h.");
      await expect(card.getByRole("button", { exact: true, name: "Listen" })).toBeVisible();
      await expect(card.getByRole("button", { name: "Listen slowly" })).toBeVisible();

      await page.getByRole("button", { name: "Say the word" }).click();

      await expect(
        page.getByText("The microphone isn't available here. You can skip this word."),
      ).toBeVisible();

      await page.getByRole("button", { name: "Skip this word" }).click();
      await expect(page.getByText("Word 2 of 2")).toBeVisible();
      await expect(page.getByText(deposit.word, { exact: true })).toBeVisible();

      await page.getByRole("button", { name: "Skip this word" }).click();

      await expect(
        page.getByRole("heading", { level: 1, name: "Nothing said this time" }),
      ).toBeVisible();

      await page.getByRole("link", { name: "Back to Today" }).click();
      await expect(page).toHaveURL(/\/today$/u);

      // Skipped words stay due: they come back until they're said.
      await expect(page.getByRole("link", { name: /Say 2 words again/u })).toBeVisible();
    });
  });
});
