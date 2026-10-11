import { randomUUID } from "node:crypto";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import {
  choiceItemContent,
  itemFixture,
  itemSetFixture,
  skillFixture,
  textSetContent,
} from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { pickItemSetTargets } from "./item-set-targets";

const citation = { passage: "…", sourceId: "notice" };

/** A Cebraspe statement as the bank stores it. */
function trueFalseContent(statement: string) {
  return { context: null, isTrue: true, misconception: null, reason: "Por quê.", statement };
}

/** Cebraspe's format: statements judged right or wrong. */
const STATEMENTS = {
  citation,
  description: "Itens certo ou errado.",
  kind: "trueFalse",
  options: null,
};

/**
 * An exam goal whose first phase has three areas: Reading (weights 5, 3, 1, 4), Law (2, 1) and
 * Math (a lone skill), with a later phase that never gets a set.
 */
async function examGoal() {
  const [user, blueprint, skills] = await Promise.all([
    userFixture(),
    examBlueprintFixture({
      identityKey: `exam-${randomUUID()}`,
      name: "Cebraspe",
      structure: { formats: [STATEMENTS], mock: null, rules: [], subjects: [] },
    }),
    Promise.all(Array.from({ length: 8 }, (_, index) => skillFixture({ name: `Skill ${index}` }))),
  ]);

  const goal = await goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: user.id });

  const layout = [
    { area: "Reading", phase: 0, weight: 5 },
    { area: "Reading", phase: 0, weight: 3 },
    { area: "Reading", phase: 0, weight: 1 },
    { area: "Reading", phase: 0, weight: 4 },
    { area: "Law", phase: 0, weight: 2 },
    { area: "Law", phase: 0, weight: 1 },
    { area: "Math", phase: 0, weight: 9 },
    { area: "History", phase: 1, weight: 9 },
  ];

  await planFixture({
    goalId: goal.id,
    graph: {
      phases: [
        { milestone: null, name: "Foundations" },
        { milestone: null, name: "Exam practice" },
      ],
      skills: skills.map((skill, index) => ({
        area: layout[index]?.area ?? null,
        lessons: 1,
        name: skill.name,
        phase: layout[index]?.phase ?? 0,
        skillId: skill.id,
        weight: layout[index]?.weight ?? null,
      })),
    },
  });

  return { blueprint, goal, skills };
}

describe(pickItemSetTargets, () => {
  it("picks the first phase's most weighted areas, their top skills, in the exam's quick format", async () => {
    const { blueprint, goal, skills } = await examGoal();

    const targets = await pickItemSetTargets({ goalId: goal.id });

    expect(targets.map((target) => target.skills.map((skill) => skill.id))).toStrictEqual([
      [skills[0]?.id, skills[3]?.id, skills[1]?.id],
      [skills[4]?.id, skills[5]?.id],
    ]);

    expect(targets[0]).toMatchObject({ format: "trueFalse", usedTitles: [] });
    expect(targets[0]?.skills[0]?.exam).toMatchObject({ blueprintId: blueprint.id });
  });

  it("skips an area the exam already has a set on, and says which titles its sets use", async () => {
    const { blueprint, goal, skills } = await examGoal();

    const set = await itemSetFixture({
      content: textSetContent("Domingos na biblioteca"),
      examBlueprintId: blueprint.id,
    });

    await itemFixture({
      content: choiceItemContent(),
      examBlueprintId: blueprint.id,
      setId: set.id,
      setPosition: 0,
      skillId: skills[3]?.id ?? "",
    });

    const targets = await pickItemSetTargets({ goalId: goal.id });

    expect(targets.map((target) => target.skills.map((skill) => skill.id))).toStrictEqual([
      [skills[4]?.id, skills[5]?.id],
    ]);

    expect(targets[0]?.usedTitles).toStrictEqual(["Domingos na biblioteca"]);
  });

  it("shows the writer the exam's quoted past questions, the area's own first", async () => {
    const { blueprint, goal, skills } = await examGoal();
    const quoted = (statement: string) => ({ ...trueFalseContent(statement), quoted: true });

    await Promise.all([
      itemFixture({
        content: quoted("A lei federal prevalece."),
        examBlueprintId: blueprint.id,
        format: "trueFalse",
        skillId: skills[6]?.id ?? "",
      }),
      itemFixture({
        content: quoted("O ato pode ser revogado."),
        examBlueprintId: blueprint.id,
        format: "trueFalse",
        skillId: skills[4]?.id ?? "",
      }),
      // Written for the app, not copied from a paper: never shown as a past question.
      itemFixture({
        content: trueFalseContent("Uma questão original."),
        examBlueprintId: blueprint.id,
        format: "trueFalse",
        skillId: skills[4]?.id ?? "",
      }),
    ]);

    const [reading, law] = await pickItemSetTargets({ goalId: goal.id });

    expect(law?.skills[0]?.exam?.pastQuestions).toStrictEqual([
      "O ato pode ser revogado.",
      "A lei federal prevalece.",
    ]);

    expect(reading?.skills[0]?.exam?.pastQuestions).toHaveLength(2);
  });

  it("picks nothing for a goal that isn't an exam", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    await expect(pickItemSetTargets({ goalId: goal.id })).resolves.toStrictEqual([]);
  });
});
