import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { pronunciationReviewFixture } from "@zoonk/testing/fixtures/pronunciation-reviews";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { allowPronunciationRecording } from "./pronunciation-recording";
import { saveMissions } from "./study-day";

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

test.describe("Pronunciation reviews", () => {
  test("a recorded round saves each word and completes the pronunciation activity", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      const { rent, deposit } = await seedDueWords(user.id);

      await allowPronunciationRecording(page);
      await page.goto("/today");

      const session = await prisma.studySession.findFirstOrThrow({
        orderBy: { createdAt: "desc" },
        where: { goalId: user.goalId, userId: user.id },
      });

      await saveMissions(session.id, [
        { anchor: {}, kind: "pronunciation", opens: { kind: "pronunciation" }, total: 1 },
      ]);

      await page.reload();

      const mission = page
        .getByRole("region", { name: "Today's missions" })
        .getByRole("link", { name: /^Pronunciation/u });

      await expect(mission).toHaveAttribute("href", `/pronunciation?goal=${user.goalId}`);
      await mission.click();
      await expect(page.getByRole("region", { name: "The word to say" })).toContainText(rent.word);
      await page.getByRole("button", { exact: true, name: "Record" }).click();
      await page.getByRole("button", { name: /^Stop/u }).click();
      await expect(page.getByRole("status")).toContainText("That sounded right");
      await expect(page.getByRole("region", { name: "The word to say" })).toContainText(rent.word);

      await expect(
        prisma.pronunciationReview.count({
          where: {
            dueAt: { lte: new Date() },
            userId: user.id,
            wordId: { in: [rent.id, deposit.id] },
          },
        }),
      ).resolves.toBe(1);

      await page.getByRole("button", { exact: true, name: "Continue" }).click();

      await expect(page.getByRole("region", { name: "The word to say" })).toContainText(
        deposit.word,
      );

      await page.getByRole("button", { exact: true, name: "Record" }).click();
      await page.getByRole("button", { name: /^Stop/u }).click();
      await expect(page.getByRole("status")).toContainText("That sounded right");

      await expect(page.getByRole("region", { name: "The word to say" })).toContainText(
        deposit.word,
      );

      await expect(
        prisma.pronunciationReview.count({
          where: {
            dueAt: { lte: new Date() },
            userId: user.id,
            wordId: { in: [rent.id, deposit.id] },
          },
        }),
      ).resolves.toBe(0);

      await page.getByRole("button", { name: "See how it went" }).click();

      await expect(
        page.getByRole("heading", { level: 1, name: "2 of 2 sounded right" }),
      ).toBeVisible();

      const event = await prisma.learningEvent.findFirstOrThrow({
        orderBy: { createdAt: "desc" },
        where: { lessonKind: "pronunciationReview", userId: user.id },
      });

      expect(event).toMatchObject({ correctAnswers: 2, incorrectAnswers: 0 });

      await expect(
        prisma.attempt.findMany({
          select: { isCorrect: true },
          where: {
            OR: [
              { answer: { equals: rent.word, path: ["transcript"] } },
              { answer: { equals: deposit.word, path: ["transcript"] } },
            ],
            userId: user.id,
          },
        }),
      ).resolves.toStrictEqual([{ isCorrect: true }, { isCorrect: true }]);
    });
  });
});
