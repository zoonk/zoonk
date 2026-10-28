import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { isJsonObject } from "@zoonk/utils/json";
import { expect, test } from "./fixtures";

const LANGUAGES = "Linguagens";
const FOREIGN = "Língua Estrangeira";
const ENGLISH = "Língua Inglesa";
const SPANISH = "Língua Espanhola";

async function loadPicks(goalId: string): Promise<unknown> {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  return isJsonObject(plan.settings) ? (plan.settings.examChoices ?? []) : null;
}

function choiceBlueprintFixture() {
  const citation = { passage: "Língua Estrangeira (Inglês ou Espanhol)", sourceId: "notice" };

  const option = { choiceGroup: FOREIGN, citation, partOf: LANGUAGES, questions: 5, weight: null };

  return examBlueprintFixture({
    language: "pt",
    name: "ENEM",
    structure: {
      formats: [
        { citation, description: "Cinco alternativas", kind: "multipleChoice", options: 5 },
      ],
      mock: null,
      rules: [],
      subjects: [
        { citation, name: LANGUAGES, questions: 45, topics: ["Leitura"], weight: null },
        { ...option, name: ENGLISH, shortName: "Inglês", topics: ["Reading"] },
        { ...option, name: SPANISH, shortName: "Espanhol", topics: ["Lectura"] },
      ],
    },
  });
}

async function createChoiceGoal(userId: string) {
  const blueprint = await choiceBlueprintFixture();

  const goal = await goalFixture({
    details: { answered: ["target"], examName: "ENEM" },
    examBlueprintId: blueprint.id,
    kind: "exam",
    title: "Passar no ENEM",
    userId,
  });

  await planFixture({ goalId: goal.id, phases: [] });
  return goal;
}

test("a new exam goal asks which option the learner takes, saves it for the plan and goes on", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createChoiceGoal(noProgressUser.id);

  await page.goto(`/start/${goal.id}`);

  const options = page.getByRole("radiogroup", { name: FOREIGN });
  await options.getByRole("radio", { name: /Espanhol/u }).click();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect.poll(() => loadPicks(goal.id)).toStrictEqual([{ group: FOREIGN, subject: SPANISH }]);

  await expect(
    page.getByRole("heading", { name: "Which subjects do you already know well?" }),
  ).toBeVisible();
});
