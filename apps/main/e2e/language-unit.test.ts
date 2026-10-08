import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { pronunciationReviewFixture } from "@zoonk/testing/fixtures/pronunciation-reviews";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { answerLiveCalls } from "./live-gateway";

const RENTING_UNIT = "Alugando um apartamento";

/** Two open mistakes on the renting unit's screens: a word and a spoken answer. */
async function addUnitMistakes({ goalId, userId }: { goalId: string; userId: string }) {
  const goal = await prisma.goal.findUniqueOrThrow({
    select: { primaryCourseId: true },
    where: { id: goalId },
  });

  const { chapter: unit } = await prisma.courseChapter.findFirstOrThrow({
    select: {
      chapter: {
        select: {
          lessons: { select: { lesson: { select: { steps: { select: { id: true } } } } } },
        },
      },
    },
    where: { chapter: { title: RENTING_UNIT }, courseId: goal.primaryCourseId ?? "" },
  });

  const [wordStep, spokenStep] = unit.lessons.flatMap(({ lesson }) => lesson.steps);

  return prisma.mistake.createManyAndReturn({
    data: [
      {
        snapshot: {
          answer: "rent",
          correctAnswer: "lease",
          explanation: "Lease é o contrato; rent é o valor mensal.",
          format: "vocabulary",
          question: "O contrato de aluguel se chama…",
        },
        stepId: wordStep?.id,
        userId,
      },
      {
        snapshot: {
          answer: "Is the apartment available still?",
          correctAnswer: "Is the apartment still available?",
          explanation: "Still vem antes do adjetivo.",
          format: "spokenAnswer",
          question: "Pergunte se o apartamento ainda está livre.",
        },
        stepId: spokenStep?.id,
        userId,
      },
    ],
    select: { id: true },
  });
}

/** A word Marcos mispronounced in a call, due to be said again now. */
async function addDueWord(userId: string) {
  const organization = await aiOrganizationFixture();

  const word = await wordFixture({
    organizationId: organization.id,
    targetLanguage: "en",
    word: `lease${randomUUID().slice(0, 6)}`,
  });

  await pronunciationReviewFixture({
    dueAt: new Date(Date.now() - 60_000),
    userId,
    wordId: word.id,
  });
}

/**
 * A language unit's page for Marcos's English goal, opened from the Journey's path: its lessons
 * with the next one first, what it teaches, a practice call that runs from its intro to its
 * result, its test-out, the pattern noticed in its mistakes and the words to say again, then
 * folded away its grammar tips, words, his mistakes filtered by skill and the summary of the
 * lesson he finished.
 */
test.describe("Language unit page", () => {
  test("opens from the Journey, shows everything about practicing the unit, and runs a practice call to its result", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      const [unitMistakes] = await Promise.all([
        addUnitMistakes({ goalId: user.goalId, userId: user.id }),
        addDueWord(user.id),
      ]);

      // The "since" pattern he was shown in the last week came from one of this unit's mistakes.
      const [pattern] = await Promise.all([
        prisma.mistakePattern.findFirstOrThrow({ where: { userId: user.id } }),
        prisma.mistakePattern.updateMany({
          data: { mistakeIds: unitMistakes.map((mistake) => mistake.id) },
          where: { userId: user.id },
        }),
      ]);

      // The call's stand-in is set before the first page loads: Playwright puts it into a page
      // when the page loads, and the call opens later in the same page.
      await answerLiveCalls(page, "answers");
      await page.goto("/journey");

      // A language goal's path runs through its units: the one he finished is a done phase, and
      // the one he's in is open with the unit next.
      const path = page.getByRole("list", { name: "Your journey" });

      await expect(
        path.getByRole("button", { name: /^Chegando: aeroporto e imigração\s*, done$/u }),
      ).toHaveAttribute("aria-expanded", "false");

      const unit = path.getByRole("link", { name: `${RENTING_UNIT} Up next` });
      await expect(unit).toHaveAttribute("href", /^\/content\/units\/[\da-f-]{36}$/u);
      await unit.click();

      await expect(page).toHaveURL(/\/content\/units\/[\da-f-]{36}$/u);
      const unitPath = new URL(page.url()).pathname;

      await expect(page.getByRole("heading", { level: 1, name: RENTING_UNIT })).toBeVisible();
      await expect(page.getByText("Unit 2 · A1–A2")).toBeVisible();

      await expect(page.getByRole("link", { name: /^Continue\s*25% complete$/u })).toHaveAttribute(
        "href",
        /\/learn\/[\da-f-]{36}$/u,
      );

      await expect(page.getByRole("button", { name: "Unit options" })).toBeVisible();

      await expect(
        page.getByRole("main").getByRole("link", { name: "Back to Journey" }),
      ).toHaveAttribute("href", "/journey");

      // Every lesson opens in the player, in teaching order, the next one marked.
      const lessons = page.getByRole("region", { name: "Lessons" });
      await expect(lessons.getByText("1 of 4", { exact: true })).toBeVisible();
      await expect(lessons.getByRole("link")).toHaveCount(4);

      await expect(
        lessons.getByRole("link", { name: /^Up next \d+\. There is, there are \d+ min$/u }),
      ).toHaveAttribute("href", /\/learn\/[\da-f-]{36}$/u);

      await expect(
        lessons.getByRole("link", { name: /^Done \d+\. Quanto é o aluguel\?/u }),
      ).toHaveAttribute("href", /\/learn\/[\da-f-]{36}$/u);

      await expectAccessibleScreen(page, "a unit");

      await expect(
        page.getByRole("link", { name: "We noticed a pattern “Since” e “for”" }),
      ).toHaveAttribute("href", `/pattern/${pattern.id}`);

      await expect(page.getByRole("link", { name: /^Say 1 word again/u })).toHaveAttribute(
        "href",
        `/pronunciation?goal=${user.goalId}`,
      );

      const objectives = page.getByRole("region", { name: "By the end of this unit" });

      await expect(objectives.getByRole("listitem")).toHaveText([
        "Consigo perguntar o preço do aluguel e as regras",
        "Consigo descrever um apartamento",
        "Consigo marcar uma visita",
      ]);

      // Lessons are left, so the test that skips the unit is there.
      await expect(page.getByText("Already know this?")).toBeVisible();
      await expect(page.getByRole("button", { name: "Take the test" })).toBeEnabled();

      // The rest is folded away until asked for.
      const tips = page.getByRole("button", { name: /^Grammar tips/u });
      await expect(tips).toHaveAttribute("aria-expanded", "false");
      await tips.click();

      await expect(
        page
          .getByRole("listitem")
          .filter({ has: page.getByRole("heading", { name: "How much ou how many?" }) }),
      ).toContainText("How much is the rent?");

      await page.getByRole("button", { name: /^Words in this unit/u }).click();
      await expect(page.getByText(/^bedroom · bathroom · rent/u)).toBeVisible();

      // The filters split the unit's mistakes by skill, so they add up to all of them.
      await page.getByRole("button", { name: /^Review my mistakes/u }).click();
      const all = page.getByRole("list", { name: "All mistakes" }).getByRole("listitem");
      const filters = page.getByRole("group", { name: "Show mistakes in" }).getByRole("button");

      await expect(filters).toHaveText([/Words$/u, /Listening$/u, /Speaking$/u, /Writing$/u]);
      const total = await all.count();
      const byFilter = await filters.allTextContents();

      expect(total).toBeGreaterThanOrEqual(unitMistakes.length);
      // Each filter reads its count, then its skill: "1Speaking".
      const counted = byFilter.map((text) => Number(/^\d+/u.exec(text)?.[0] ?? 0));
      expect(counted.reduce((sum, count) => sum + count, 0)).toBe(total);

      await filters.filter({ hasText: "Speaking" }).click();

      const speaking = page.getByRole("list", { name: "Speaking" });
      await expect(speaking.getByRole("listitem")).toHaveCount(1);
      await expect(speaking.getByText("Is the apartment still available?")).toBeVisible();
      await expect(speaking.getByText("Still vem antes do adjetivo.")).toBeVisible();

      await page.getByRole("button", { name: "Unit summary" }).click();
      const summaries = page.getByRole("region", { name: "Summaries" });
      await expect(summaries.getByRole("heading", { name: "Quanto é o aluguel?" })).toBeVisible();
      await expect(summaries.getByText("Deposit é a caução; lease é o contrato.")).toBeVisible();

      // The call opens in a sheet: who it's with and how long, then "Start the call".
      await page.getByRole("button", { name: "Practice a conversation" }).click();
      const call = page.getByRole("dialog", { name: "Practice a conversation" });
      await expect(call.getByText("with Linda")).toBeVisible();

      await expect(
        call.getByRole("group", { name: "Call length" }).getByRole("radio", { name: "2 min" }),
      ).toBeChecked();

      await call.getByRole("button", { name: "Start the call" }).click();

      await expect(page).toHaveURL(/\/conversation\/[\da-f-]{36}$/u);
      await expect(page.getByText("Linda · proprietária · Queen Street")).toBeVisible();
      await expect(page.getByText("Book a viewing")).toBeVisible();

      await page.getByRole("button", { name: "Start the call" }).click();

      await expect(
        page.getByRole("log", { name: "Conversation" }).getByText("Hi! Are you calling"),
      ).toBeVisible();

      await page.getByRole("button", { exact: true, name: "End" }).click();

      // Nothing was said, so there's no feedback; the stars still come from what was done, and say
      // how to earn the one missing.
      await expect(page.getByRole("img", { name: "2 of 3 stars" })).toBeVisible();

      await expect(
        page.getByText(
          "A star for finishing, one for getting everything across and one without Help.",
        ),
      ).toBeVisible();

      const conversation = await prisma.languageConversation.findFirstOrThrow({
        where: { kind: "practice", userId: user.id },
      });

      expect(conversation).toMatchObject({ minutes: 2, status: "completed" });

      // A language goal's chapter has one page, the unit's.
      await page.goto(unitPath.replace("/content/units/", "/content/chapters/"));
      await expect(page).toHaveURL(new RegExp(`${unitPath}$`, "u"));

      // An unknown unit isn't found.
      await page.goto(`/content/units/${randomUUID()}`);
      await expect(page.getByRole("heading", { name: "We couldn't find this page" })).toBeVisible();
    });
  });
});
