import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  examBlueprintFixture,
  learnerSourceFixture,
  sourceFixture,
} from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { loadStatuteDrillTargets, writeStatuteDrills } from "./statute-drill-targets";

const LAW_TEXT = `LEI Nº 8.112, DE 11 DE DEZEMBRO DE 1990
Art. 7º A investidura em cargo público ocorrerá com a posse, na forma desta lei.
Art. 13. A posse dar-se-á pela assinatura do respectivo termo, no qual deverão constar as atribuições.`;

const PROVENANCE = {
  generatedAt: new Date().toISOString(),
  model: "test-model",
  promptVersion: "test",
  runId: `run-${crypto.randomUUID()}`,
};

async function lawGoal() {
  const user = await userFixture();

  const blueprint = await examBlueprintFixture({
    board: "Cebraspe",
    structure: {
      formats: [],
      mock: {
        adaptive: false,
        citations: [],
        order: null,
        scoring: {
          description: "A wrong answer cancels a right one.",
          method: "wrongCancelsRight",
        },
        sections: [],
        timeLimitMinutes: null,
        totalQuestions: null,
      },
      rules: [],
      subjects: [],
    },
  });

  const goal = await goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: user.id });
  const skill = await skillFixture({ name: "Lei nº 8.112" });
  const other = await skillFixture({ name: "Reading comprehension" });

  await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ name: "Basics" }],
      skills: [
        { area: "Law", lessons: 1, name: skill.name, phase: 0, skillId: skill.id, weight: 3 },
        {
          area: "Portuguese",
          lessons: 1,
          name: other.name,
          phase: 0,
          skillId: other.id,
          weight: 2,
        },
      ],
    },
  });

  const [law, notice] = await Promise.all([
    sourceFixture({
      extractedText: LAW_TEXT,
      title: "Lei nº 8.112, de 11 de dezembro de 1990",
      url: "https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm",
    }),
    sourceFixture({ extractedText: "Edital nº 1", title: "Edital nº 1" }),
  ]);

  await Promise.all(
    [law, notice].map((source) =>
      learnerSourceFixture({
        goalId: goal.id,
        origin: "research",
        sourceId: source.id,
        userId: user.id,
      }),
    ),
  );

  return { blueprint, goal, law, skill };
}

describe("statute drills", () => {
  it("finds a goal's laws with their articles, skill and the board's style", async () => {
    const { goal, law, skill } = await lawGoal();

    await expect(loadStatuteDrillTargets(goal.id)).resolves.toMatchObject([
      {
        articles: [{ reference: "Art. 7º" }, { reference: "Art. 13" }],
        law: { shortName: "Lei nº 8.112", url: law.url },
        skillId: skill.id,
        sourceId: law.id,
        style: "cebraspe",
      },
    ]);
  });

  it("stores each drill citing its article and linked to the law", async () => {
    const { goal } = await lawGoal();
    const [target] = await loadStatuteDrillTargets(goal.id);

    if (!target) {
      throw new Error("Expected a law to drill");
    }

    const created = await writeStatuteDrills({
      drills: [
        {
          context: null,
          difficulty: "easy",
          format: "trueFalse",
          isTrue: false,
          misconception: "Swaps posse for exercício",
          reason: "Investiture happens with the posse.",
          reference: "Art. 7º",
          statement: "A investidura em cargo público ocorrerá com o exercício.",
        },
        {
          context: null,
          difficulty: "easy",
          format: "trueFalse",
          isTrue: true,
          misconception: null,
          reason: "It's the article's text.",
          reference: "Art. 13",
          statement: "A posse dar-se-á pela assinatura do respectivo termo.",
        },
      ],
      optionCount: 4,
      provenance: PROVENANCE,
      target,
    });

    expect(created).toBe(2);

    const items = await prisma.item.findMany({
      orderBy: { sourceCitation: "asc" },
      where: { skillId: target.skillId },
    });

    expect(items.map((item) => [item.sourceCitation, item.sourceId])).toStrictEqual([
      ["Lei nº 8.112, Art. 13", target.sourceId],
      ["Lei nº 8.112, Art. 7º", target.sourceId],
    ]);
  });
});
