import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { pronunciationReviewFixture } from "@zoonk/testing/fixtures/pronunciation-reviews";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { type Page, expect, test } from "./fixtures";
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

/** Today reads itself again, as a write elsewhere would make it, keeping the pages it has. */
function refreshRouter(page: Page) {
  return page.evaluate(() => {
    (globalThis as unknown as { next: { router: { refresh: () => void } } }).next.router.refresh();
  });
}

/**
 * Words a language learner mispronounced come back as "Say it again" on Today: each one with its
 * respelling, tip and native sound, said out loud or skipped. Grading the sound calls a paid
 * model, so E2E substitutes only that external assessment. Recording and round completion use the
 * real actions; a refused microphone also covers skipped words.
 */
test.describe("Pronunciation reviews", () => {
  test("a graded round earns activity points separately from its last mission's +50", async ({
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

      const before = await prisma.userProgress.findUnique({ where: { userId: user.id } });
      const brainPowerBefore = before?.totalBrainPower ?? 0n;
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
      await expect(page.getByRole("progressbar", { name: "Word 1 of 2" })).toBeVisible();

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
      await expect(page.getByRole("progressbar", { name: "Word 2 of 2" })).toBeVisible();

      await expect(page.getByRole("region", { name: "The word to say" })).toContainText(
        deposit.word,
      );

      await page.getByRole("button", { exact: true, name: "Record" }).click();
      await page.getByRole("button", { name: /^Stop/u }).click();
      await expect(page.getByRole("status")).toContainText("That sounded right");

      await expect(page.getByRole("region", { name: "The word to say" })).toContainText(
        deposit.word,
      );

      await expect(page.getByRole("progressbar", { name: "Word 2 of 2" })).toBeVisible();

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

      const result = page.getByRole("status").filter({ hasText: "Mission done: Pronunciation" });
      await expect(result.getByRole("listitem")).toHaveText("+6 Brain Power");
      await expect(result).toContainText("from today's missions");

      await expect(page.getByRole("button", { exact: true, name: "+50 Brain Power" })).toHaveCount(
        1,
      );

      await expect(result.getByText("+56 Brain Power", { exact: true })).toHaveCount(0);

      const event = await prisma.learningEvent.findFirstOrThrow({
        orderBy: { createdAt: "desc" },
        where: { lessonKind: "pronunciationReview", userId: user.id },
      });

      expect(event).toMatchObject({ brainPower: 6, correctAnswers: 2, incorrectAnswers: 0 });

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

      await expect(
        prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
      ).resolves.toMatchObject({
        fullMealAt: expect.any(Date),
        startSnapshot: {
          fullMealReward: {
            after: Number(brainPowerBefore) + 56,
            before: Number(brainPowerBefore) + 6,
          },
        },
      });

      await expect(
        prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
      ).resolves.toMatchObject({ totalBrainPower: brainPowerBefore + 56n });
    });
  });

  test("opens the due words from Today, walks through them, and starts afresh on each return", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      // Opened by its link before any word is due, it says so and goes back to Today.
      await page.goto(`/pronunciation?goal=${user.goalId}`);
      await expect(page.getByRole("status")).toHaveText("No words to say again today.");
      await page.getByRole("link", { exact: true, name: "Done" }).click();
      await expect(page).toHaveURL(/\/today$/u);

      const { deposit, rent } = await seedDueWords(user.id);

      const session = await prisma.studySession.findFirstOrThrow({
        orderBy: { createdAt: "desc" },
        where: { goalId: user.goalId, userId: user.id },
      });

      await saveMissions(session.id, [
        { anchor: {}, kind: "pronunciation", opens: { kind: "pronunciation" }, total: 1 },
      ]);

      // Fixtures bypass cache invalidation: Today reads again, keeping the pages it already has,
      // so the link's next visit can't reuse the empty round.
      await refreshRouter(page);

      const mission = page
        .getByRole("region", { name: "Today's missions" })
        .getByRole("link", { name: /^Pronunciation/u });

      await expect(mission).toBeVisible();
      await expect(mission).toHaveAttribute("href", `/pronunciation?goal=${user.goalId}`);
      await mission.click();
      await expect(page).toHaveURL(/\/pronunciation\?goal=[\da-f-]{36}$/u);

      // Where the round is, once: a segment per word under the header.
      await expect(page.getByRole("progressbar", { name: "Word 1 of 2" })).toBeVisible();
      await expect(page.locator("[data-segment]")).toHaveCount(2);

      const card = page.getByRole("region", { name: "The word to say" });
      await expect(card.getByText(rent.word, { exact: true })).toBeVisible();
      await expect(card).toContainText("Say it like RÉNT");
      await expect(card).toContainText("Em inglês, o r do começo não soa como h.");
      await expect(card.getByRole("button", { exact: true, name: "Listen" })).toBeVisible();
      await expect(card.getByRole("button", { name: "Listen slowly" })).toBeVisible();

      await page.getByRole("button", { name: "Record" }).click();

      await expect(
        page.getByText("The microphone isn't available here. You can skip this word."),
      ).toBeVisible();

      await page.getByRole("button", { name: "Skip this word" }).click();
      await expect(page.getByRole("progressbar", { name: "Word 2 of 2" })).toBeVisible();
      await expect(page.getByText(deposit.word, { exact: true })).toBeVisible();

      await page.getByRole("button", { name: "Skip this word" }).click();

      await expect(
        page.getByRole("heading", { level: 1, name: "Nothing said this time" }),
      ).toBeVisible();

      await expect(page.getByRole("button", { name: "+50 Brain Power" })).toHaveCount(0);
      await expect(page.getByText("Mission done: Pronunciation", { exact: true })).toHaveCount(0);

      await expect(
        prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
      ).resolves.toMatchObject({ fullMealAt: null });

      await expect(
        prisma.learningEvent.count({
          where: { lessonKind: "pronunciationReview", userId: user.id },
        }),
      ).resolves.toBe(0);

      await page.getByRole("link", { name: "Done" }).click();
      await expect(page).toHaveURL(/\/today$/u);

      // Skipped words stay due: they come back until they're said, in a new round from the first.
      await refreshRouter(page);
      await expect(mission).toBeVisible();
      await mission.click();
      await expect(page.getByRole("progressbar", { name: "Word 1 of 2" })).toBeVisible();
      await expect(card.getByText(rent.word, { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Nothing said this time" })).toHaveCount(0);

      // Before any recording, the screen's menu skips a word too.
      await page.getByRole("button", { name: "Screen options" }).click();
      await page.getByRole("menuitem", { name: "Skip this word" }).click();
      await expect(card).toContainText(deposit.word);
    });
  });
});
