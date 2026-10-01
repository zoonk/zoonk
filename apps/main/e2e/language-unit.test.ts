import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleRoutes, expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

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

  await prisma.mistake.createMany({
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
  });
}

/**
 * A language unit's page for Marcos's English goal, opened from Content: grammar tips, words, his
 * mistakes filtered by skill, and a practice call that runs from its intro to its result.
 */
test.describe("Language unit page", () => {
  test("shows tips, words and mistakes by skill, and runs a practice call to its result", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "fun", persona: "language" }, async ({ page, user }) => {
      await addUnitMistakes({ goalId: user.goalId, userId: user.id });
      await page.goto("/content");

      const unit = page
        .getByRole("navigation", { name: "Units" })
        .getByRole("link", { name: new RegExp(RENTING_UNIT, "u") });

      await expect(unit).toBeVisible();
      await expectAccessibleScreen(page, "Cards for a language goal");
      await unit.click();

      await expect(page).toHaveURL(/\/content\/units\/[\da-f-]{36}$/u);
      await expect(page.getByRole("heading", { level: 1, name: RENTING_UNIT })).toBeVisible();
      await expect(page.getByText("Unit 2 · A1–A2")).toBeVisible();
      await expectAccessibleScreen(page, "a unit");

      const tips = page.getByRole("region", { name: "Grammar tips" });
      const firstTip = tips.getByRole("button", { name: "How much ou how many?" });
      await expect(firstTip).toHaveAttribute("aria-expanded", "true");
      await expect(tips.getByText("How much is the rent?")).toBeVisible();

      const words = page.getByRole("region", { name: "Words in this unit" });
      await expect(words.getByText(/^bedroom · bathroom · rent/u)).toBeVisible();

      const mistakes = page.getByRole("region", { name: "Review my mistakes" });
      await expect(mistakes.getByRole("listitem")).toHaveCount(2);

      await mistakes.getByRole("button", { name: /Speaking/u }).click();

      await expect(mistakes.getByRole("listitem")).toHaveCount(1);
      await expect(mistakes.getByText("Is the apartment still available?")).toBeVisible();
      await expect(mistakes.getByText("Still vem antes do adjetivo.")).toBeVisible();

      const call = page.getByRole("region", { name: "Practice a conversation" });
      await expect(call.getByText("with Linda")).toBeVisible();
      await expect(call.getByRole("radio", { name: "2 min" })).toBeChecked();

      await call.getByRole("button", { name: "Start the call" }).click();

      await expect(page).toHaveURL(/\/conversation\/[\da-f-]{36}$/u);
      await expect(page.getByRole("heading", { level: 1, name: "Linda" })).toBeVisible();
      await expect(page.getByText("proprietária · Queen Street")).toBeVisible();
      await expect(page.getByText("Book a viewing")).toBeVisible();

      // Fun's intro calls the character by name.
      await page.getByRole("button", { name: "Call Linda" }).click();

      // No voice model answers in tests: the call can't connect, and ending it still saves it.
      await expect(page.getByText("The call dropped")).toBeVisible();
      await page.getByRole("button", { name: "End the call" }).click();

      await expect(page.getByText("Call finished")).toBeVisible();

      await expect(page.getByText("We didn't hear you this time.", { exact: false })).toBeVisible();

      const conversation = await prisma.languageConversation.findFirstOrThrow({
        where: { kind: "practice", userId: user.id },
      });

      expect(conversation).toMatchObject({ minutes: 2, status: "completed" });

      // An unknown unit isn't found.
      await page.goto(`/content/units/${randomUUID()}`);
      await expect(page.getByText(/not found|404/iu)).toBeVisible();

      // No Fun flow opens a language goal's Today or its mistake pattern, so they're scanned here.
      const pattern = await prisma.mistakePattern.findFirstOrThrow({ where: { userId: user.id } });

      await expectAccessibleRoutes(page, [{ path: "/today" }, { path: `/pattern/${pattern.id}` }]);
    });
  });
});
