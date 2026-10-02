import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { NET_SCORED_STRUCTURE, statement } from "./exam-fixtures";
import { expect, test } from "./fixtures";
import { type Mode, setDeviceMode } from "./learn-personas";
import { ANSWERED, mapGoalSkills } from "./onboarding-fixtures";
import { openAs } from "./study-day";

/**
 * A Cebraspe-style exam goal right before placement: its skill map is written with one statement
 * per skill, and every question before placement is answered.
 */
async function createCebraspePlacement() {
  const [user, blueprint] = await Promise.all([
    createE2EUser(getBaseURL()),
    examBlueprintFixture({ name: "Concurso Test", structure: NET_SCORED_STRUCTURE }),
  ]);

  const goal = await goalFixture({
    dailyMinutes: 30,
    details: { answered: [...ANSWERED, "target"], level: "basic" },
    examBlueprintId: blueprint.id,
    kind: "exam",
    title: `Concurso ${randomUUID()}`,
    userId: user.id,
  });

  await mapGoalSkills({ goalId: goal.id, items: false });

  const planItems = await prisma.planItem.findMany({
    select: { skillId: true },
    where: { plan: { goalId: goal.id } },
  });

  await Promise.all(
    planItems.map((item, index) =>
      itemFixture({
        content: statement(`Statement ${index + 1}`, index % 2 === 0),
        format: "trueFalse",
        skillId: item.skillId ?? "",
      }),
    ),
  );

  return { goal, user };
}

/**
 * Today's weekly mock for a Cebraspe-style exam goal, on two statements: the first true, the second
 * false.
 */
async function createCebraspeMock(mode: Mode) {
  const [user, blueprint, skill] = await Promise.all([
    createE2EUser(getBaseURL(), { withSubscription: true }),
    examBlueprintFixture({ name: "Concurso Test", structure: NET_SCORED_STRUCTURE }),
    skillFixture({ name: `Administrative law ${randomUUID()}` }),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: "UTC",
    userId: user.id,
  });

  const [statements, session] = await Promise.all([
    Promise.all(
      [statement("First statement", true), statement("Second statement", false)].map((content) =>
        itemFixture({ content, format: "trueFalse", skillId: skill.id }),
      ),
    ),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    learningProfileFixture({
      activeGoalId: goal.id,
      experienceMode: mode,
      userId: user.id,
      ...(mode === "fun" ? { buddyKind: "zu" } : {}),
    }),
  ]);

  const block = await studySessionBlockFixture({
    estimatedMinutes: 10,
    kind: "checkpoint",
    payload: {
      checkpoint: {
        kind: "weekly",
        mock: true,
        passMark: 1,
        phase: 0,
        rematch: false,
        timeLimitMinutes: 10,
      },
      itemIds: statements.map((item) => item.id),
      skillIds: [skill.id],
      title: "Mock exam",
    },
    sessionId: session.id,
  });

  return { blockId: block.id, user };
}

test("a Cebraspe goal's placement asks each statement Certo or Errado", async ({ browser }) => {
  const { goal, user } = await createCebraspePlacement();
  const page = await openAs(browser, user);
  await setDeviceMode(page.context(), "focus");

  await page.goto(`/pt/start/${goal.id}`);
  await page.getByRole("button", { exact: true, name: "Começar" }).click();
  await expect(page.getByText("Pergunta 1", { exact: true })).toBeVisible();

  const choices = page.getByRole("radiogroup");
  await expect(choices.getByRole("radio", { name: /Certo/u })).toBeVisible();
  await expect(choices.getByRole("radio", { name: /Errado/u })).toBeVisible();
  await expect(choices.getByRole("radio", { name: /Verdadeiro|Falso/u })).toHaveCount(0);

  await choices.getByRole("radio", { name: /Errado/u }).click();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Pergunta 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Certo/u })).toBeVisible();
  await page.context().close();
});

test.describe("Statements", () => {
  test("a Cebraspe mock asks Certo, Errado or Deixar em branco, and reviews in those words", async ({
    browser,
  }) => {
    const { blockId, user } = await createCebraspeMock("focus");
    const page = await openAs(browser, user);

    await page.goto(`/pt/mock/${blockId}`);

    await page.getByRole("button", { name: "Começar o simulado" }).click();

    await expect(page.getByText(/^Questão 1 de 2/u)).toBeVisible();

    const picks = page.getByRole("radiogroup");
    await expect(picks.getByRole("radio")).toHaveText([/Certo/u, /Errado/u, /Deixar em branco/u]);

    // The first statement is right: "Errado" is a mistake to review.
    await picks.getByRole("radio", { name: /Errado/u }).click();
    await page.getByRole("button", { name: "Avançar" }).click();

    await expect(page.getByText(/^Questão 2 de 2/u)).toBeVisible();
    await picks.getByRole("radio", { name: /Errado/u }).click();
    await page.getByRole("button", { name: "Entregar o simulado" }).click();

    await page.getByText("Ver a pergunta para revisar").click();
    const review = page.getByRole("listitem").filter({ hasText: "First statement" });

    await expect(review.getByRole("definition")).toHaveText(["Errado", "Certo"]);
    await page.context().close();
  });
});
