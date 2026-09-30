import { randomUUID } from "node:crypto";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { expect, test } from "./fixtures";
import { type Mode } from "./learn-personas";
import { openAs } from "./study-day";

const CITATION = "Enem 2022, 2º dia, questão 141";

/** A real past question as the import stores it: copied as printed, marked and citing its paper. */
const quotedContent = {
  context: "Uma loja reajustou um preço em 10% e, depois, deu 10% de desconto sobre o novo preço.",
  options: [
    {
      isCorrect: false,
      misconception: "Acha que os 10% se anulam",
      reason: "Os 10% do desconto incidem sobre um valor maior.",
      text: "igual.",
    },
    {
      isCorrect: true,
      misconception: null,
      reason: "1,10 × 0,90 = 0,99: 1% abaixo do original.",
      text: "1% menor.",
    },
  ],
  question: "Em relação ao preço antes do reajuste, o preço na promoção ficou",
  quoted: true,
};

/** A learner of an exam whose day is one practice block with a copied Enem question. */
async function createQuotedDay(mode: Mode) {
  const [user, skill, lesson, paper] = await Promise.all([
    createE2EUser(getBaseURL()),
    skillFixture({ name: `Successive percentages ${randomUUID()}` }),
    libraryLessonFixture({ title: "Successive percentages" }),
    sourceFixture({
      language: "pt",
      publisher: "Inep",
      title: "Enem 2022 – 2º dia – Caderno Azul",
      url: `https://download.inep.gov.br/enem/${randomUUID()}.pdf`,
    }),
  ]);

  const goal = await goalFixture({ kind: "exam", timezone: "UTC", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  const [item, session] = await Promise.all([
    itemFixture({
      content: quotedContent,
      skillId: skill.id,
      sourceCitation: CITATION,
      sourceId: paper.id,
    }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    planItemFixture({ kind: "lesson", lessonId: lesson.id, planId: plan.id, position: 0 }),
    learningProfileFixture({
      activeGoalId: goal.id,
      experienceMode: mode,
      userId: user.id,
      ...(mode === "fun" ? { buddyKind: "zu" } : {}),
    }),
  ]);

  await studySessionBlockFixture({
    estimatedMinutes: 2,
    kind: "practice",
    payload: { itemIds: [item.id], skillIds: [skill.id] },
    position: 0,
    sessionId: session.id,
  });

  return { user };
}

test.describe("Past exam questions", () => {
  test("says where a copied question is from before and after it's answered", async ({
    browser,
  }) => {
    const { user } = await createQuotedDay("focus");
    const page = await openAs(browser, user);

    const feedback = page.getByRole("region", { name: "Answer feedback" });
    await page.goto("/session");
    await page.getByRole("button", { name: /^Start/u }).click();

    await expect(page.locator('[data-slot="quoted-source"]')).toHaveText(
      `Past exam question · ${CITATION}`,
    );

    // Number keys pick an option and check it.
    await page.keyboard.press("2");
    await expect(feedback.getByText("Correct!")).toBeVisible();
    await expect(feedback.getByText(CITATION)).toBeVisible();
    await page.context().close();
  });
});
