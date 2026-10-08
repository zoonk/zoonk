import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { pickFreeResponseSkills } from "./free-response-skills";

const ESSAY_CONTENT = {
  context: null,
  keyPoints: ["Explains the cause"],
  question: "Explain one cause of the change.",
  rubric: [
    { criterion: "Claim", description: "Makes a claim", points: 1 },
    { criterion: "Reasoning", description: "Explains it", points: 2 },
  ],
  sampleOutline: "Claim and reasoning.",
};

/** An exam goal with four skills: three in its first phase (weights 1, 5, 3) and one later. */
async function examGoal({ name }: { name: string }) {
  const [user, blueprint, skills] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ identityKey: `exam-${crypto.randomUUID()}`, name }),
    Promise.all([1, 2, 3, 4].map((index) => skillFixture({ name: `Unit ${index}` }))),
  ]);

  const goal = await goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: user.id });
  const weights = [1, 5, 3, 5];

  await planFixture({
    goalId: goal.id,
    graph: {
      phases: [
        { milestone: null, name: "Foundations" },
        { milestone: null, name: "Exam practice" },
      ],
      skills: skills.map((skill, index) => ({
        area: null,
        lessons: 1,
        name: skill.name,
        phase: index < 3 ? 0 : 1,
        skillId: skill.id,
        weight: weights[index] ?? null,
      })),
    },
  });

  return { blueprint, goal, skills };
}

describe(pickFreeResponseSkills, () => {
  it("picks an AP goal's first-phase skills, most weighted first, skipping written ones", async () => {
    const { blueprint, goal, skills } = await examGoal({ name: "AP World History: Modern" });

    await itemFixture({
      content: ESSAY_CONTENT,
      examBlueprintId: blueprint.id,
      format: "essay",
      skillId: skills[2]?.id ?? "",
    });

    const picked = await pickFreeResponseSkills({ goalId: goal.id });

    expect(picked.map((skill) => skill.id)).toStrictEqual([skills[1]?.id, skills[0]?.id]);
    expect(picked[0]?.exam).toMatchObject({ blueprintId: blueprint.id });
  });

  it("picks nothing for other exams", async () => {
    const { goal } = await examGoal({ name: "Concurso TJ-AP 2026" });

    await expect(pickFreeResponseSkills({ goalId: goal.id })).resolves.toStrictEqual([]);
  });

  it("writes essays for an exam with a written test, on the skills of that test", async () => {
    const citation = { passage: "…", sourceId: "notice" };

    const [user, blueprint, objective, discursive] = await Promise.all([
      userFixture(),
      examBlueprintFixture({
        identityKey: `exam-${crypto.randomUUID()}`,
        name: "Concurso da Câmara dos Deputados",
        structure: {
          formats: [
            {
              citation,
              description: "Duas questões discursivas de até 20 linhas e uma peça técnica.",
              kind: "essay",
              options: null,
            },
          ],
          mock: {
            adaptive: false,
            citations: [],
            order: null,
            scoring: { description: "", method: "wrongCancelsRight" },
            sections: [
              { day: null, minutes: 300, name: "Provas objetivas", questions: 180 },
              {
                day: null,
                kind: "written",
                minutes: 180,
                name: "Prova discursiva (P3)",
                questions: null,
              },
            ],
            timeLimitMinutes: null,
            totalQuestions: null,
          },
          rules: [],
          subjects: [],
        },
      }),
      skillFixture({ name: "Julgar a concordância verbal" }),
      skillFixture({ name: "Redigir uma peça técnica" }),
    ]);

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    await planFixture({
      goalId: goal.id,
      graph: {
        phases: [
          { milestone: null, name: "Fundamentos" },
          { milestone: null, name: "Prática" },
        ],
        skills: [
          {
            area: "Língua Portuguesa",
            lessons: 1,
            name: objective.name,
            phase: 0,
            skillId: objective.id,
            weight: 5,
          },
          {
            area: "Prova Discursiva",
            lessons: 1,
            name: discursive.name,
            phase: 1,
            skillId: discursive.id,
            weight: 3,
          },
        ],
      },
    });

    const picked = await pickFreeResponseSkills({ goalId: goal.id });

    expect(picked.map((skill) => skill.id)).toStrictEqual([discursive.id]);
    expect(picked[0]?.exam?.style).toContain("peça técnica");
  });

  it("writes a class test's announced questions on the skills they're about, in their own form", async () => {
    const citation = {
      passage:
        "A prof disse: vai ter questão de completar a tabela das organelas e uma dissertativa sobre osmose!",
      sourceId: "notes",
    };

    const user = await userFixture();

    const [blueprint, cells, organelles, osmosis] = await Promise.all([
      examBlueprintFixture({
        identityKey: `private:${user.id}:prova-de-biologia-${crypto.randomUUID()}`,
        name: "Prova de Biologia",
        ownerId: user.id,
        structure: {
          formats: [
            {
              citation,
              description: "Questão dissertativa sobre osmose.",
              kind: "essay",
              options: null,
            },
            {
              citation,
              description: "Questão de completar a tabela das organelas.",
              kind: "shortAnswer",
              options: null,
            },
          ],
          mock: null,
          rules: [],
          subjects: [],
        },
        visibility: "private",
      }),
      skillFixture({ name: "Diferenciar células procarióticas, eucarióticas e vírus" }),
      skillFixture({ name: "Relacionar organelas citoplasmáticas e núcleo às suas funções" }),
      skillFixture({
        name: "Analisar transporte por membrana plasmática e resolver questões de osmose",
      }),
    ]);

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Dia 1" }],
        skills: [cells, organelles, osmosis].map((skill) => ({
          area: "Biologia",
          lessons: 1,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        })),
      },
    });

    const picked = await pickFreeResponseSkills({ goalId: goal.id });

    expect(picked.map((skill) => [skill.id, skill.exam?.style])).toStrictEqual([
      [osmosis.id, "essay: Questão dissertativa sobre osmose."],
      [organelles.id, "shortAnswer: Questão de completar a tabela das organelas."],
    ]);
  });
});
