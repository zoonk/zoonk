import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { pronunciationReviewFixture } from "@zoonk/testing/fixtures/pronunciation-reviews";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { answerLiveCalls } from "./live-peer";

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
 * A language unit's page for Marcos's English goal, opened from the Plan's path: its lessons
 * with the next one marked, what it teaches, a practice call that runs from its intro to its
 * result, its test-out, the pattern noticed in its mistakes and the words to say again, then
 * folded away its grammar tips, words, his mistakes with their skills and the summary of the
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
      await page.goto("/plan");

      // Each of his phases is one unit, so each is one row opening the unit's page, its name said
      // once: the one he finished is done, and the one he's in is the path's highlighted row, with
      // no chip to say it again.
      const path = page.getByRole("list", { name: "Your path" });

      // A row is named by its name and state in one run, never "… , done", and described by the
      // rest of it.
      const finished = path.getByRole("link", {
        exact: true,
        name: "Chegando: aeroporto e imigração, done",
      });

      await expect(finished).toHaveAttribute("href", /^\/content\/units\/[\da-f-]{36}$/u);
      await expect(finished).toHaveAccessibleDescription(/^\d+ of \d+ lessons? done$/u);

      const current = path.locator(':scope > li[aria-current="step"]');
      const unit = current.getByRole("link", { name: new RegExp(RENTING_UNIT, "u") });

      await expect(unit).toHaveCount(1);
      await expect(unit).toContainText(", you are here");
      await expect(unit).toHaveAccessibleName(`${RENTING_UNIT}, you are here`);
      await expect(unit).toHaveAttribute("href", /^\/content\/units\/[\da-f-]{36}$/u);
      await expect(path.getByText("Up next", { exact: true })).toHaveCount(0);
      await unit.click();

      await expect(page).toHaveURL(/\/content\/units\/[\da-f-]{36}$/u);
      const unitPath = new URL(page.url()).pathname;

      await expect(page.getByRole("heading", { level: 1, name: RENTING_UNIT })).toBeVisible();
      await expect(page.getByText("Unit 2 · A1–A2")).toBeVisible();

      await expect(page.getByRole("link", { exact: true, name: "Continue" })).toHaveAttribute(
        "href",
        /\/learn\/[\da-f-]{36}$/u,
      );

      await expect(page.getByRole("button", { name: "Unit options" })).toBeVisible();

      await expect(
        page.getByRole("main").getByRole("link", { name: "Back to Plan" }),
      ).toHaveAttribute("href", "/plan");

      // Every lesson opens in the player, in teaching order; "Continue" opens the next one. The
      // unit he's in holds the plan's next lesson, so its list marks it, as the Plan marks the
      // unit.
      const lessons = page.getByRole("region", { name: "Lessons" });
      await expect(lessons.getByText("1 of 4", { exact: true })).toBeVisible();
      await expect(lessons.getByRole("link")).toHaveCount(4);
      await expect(page.getByText(/^4 lessons(?: · About \d+\smin)? · 25% done$/u)).toBeVisible();

      const nextLesson = lessons.getByRole("link", {
        name: /^Up next \d+\. There is, there are \d+ min$/u,
      });

      await expect(nextLesson).toHaveAttribute("href", /\/learn\/[\da-f-]{36}$/u);

      await expect(nextLesson.locator("xpath=ancestor::li[1]")).toHaveAttribute(
        "aria-current",
        "step",
      );

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

      // His open mistakes on the unit, one list, each saying which skill it was, with the right
      // answer and why.
      await page.getByRole("button", { name: /^Your mistakes/u }).click();
      const all = page.getByRole("list", { name: "All mistakes" }).getByRole("listitem");
      const spoken = all.filter({ hasText: "Is the apartment still available?" });

      await expect(spoken.getByText("Speaking", { exact: true })).toBeVisible();
      await expect(spoken.getByText("Still vem antes do adjetivo.")).toBeVisible();
      expect(await all.count()).toBeGreaterThanOrEqual(unitMistakes.length);

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

      // A language goal's chapter has one page, the unit's, drawn at the chapter's address too.
      const chapterPath = unitPath.replace("/content/units/", "/content/chapters/");
      await page.goto(chapterPath);
      await expect(page).toHaveURL(new RegExp(`${chapterPath}$`, "u"));
      await expect(page.getByRole("heading", { level: 1, name: RENTING_UNIT })).toBeVisible();
      await expect(page.getByText("Unit 2 · A1–A2")).toBeVisible();

      // An unknown unit isn't found.
      await page.goto(`/content/units/${randomUUID()}`);
      await expect(page.getByRole("heading", { name: "We couldn't find this page" })).toBeVisible();
    });
  });
});
