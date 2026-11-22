import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { askPlacement } from "../_test-utils/exam-test-goal";
import { pickSessionChecks } from "./_utils/session-placement-items";

async function examGoalFixture() {
  const [user, skill, blueprint] = await Promise.all([
    userFixture(),
    skillFixture({ name: `Read a text ${crypto.randomUUID()}` }),
    examBlueprintFixture({ name: "Concurso da Câmara" }),
  ]);

  const goal = await goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: user.id });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Phase 1" }],
      skills: [
        { area: null, lessons: 1, name: skill.name, phase: 0, skillId: skill.id, weight: null },
      ],
    },
  });

  const [general] = await Promise.all([
    itemFixture({ content: choiceItemContent("A bus timetable?"), skillId: skill.id }),
    planItemFixture({ phase: 0, planId: plan.id, position: 0, skillId: skill.id }),
  ]);

  mockSession(user.id);
  return { blueprint, general, goal, skill, user };
}

function graphSkill(area: string, skill: { id: string; name: string }) {
  return { area, lessons: 1, name: skill.name, phase: 0, skillId: skill.id, weight: null };
}

function readPlacement(goalId: string) {
  return askPlacement(goalId);
}

function examItemFixture({ blueprintId, skillId }: { blueprintId: string; skillId: string }) {
  return itemFixture({
    content: choiceItemContent("In the exam's own style?"),
    examBlueprintId: blueprintId,
    skillId,
  });
}

describe("placement questions for an exam goal", () => {
  it("asks a general question while placement generation is still running", async () => {
    const { blueprint, general, goal, skill } = await examGoalFixture();

    await expect(readPlacement(goal.id)).resolves.toMatchObject({
      next: { itemId: general.id },
      status: "asking",
    });

    const exam = await examItemFixture({ blueprintId: blueprint.id, skillId: skill.id });
    await expect(readPlacement(goal.id)).resolves.toMatchObject({ next: { itemId: general.id } });

    await prisma.item.delete({ where: { id: general.id } });
    await expect(readPlacement(goal.id)).resolves.toMatchObject({ next: { itemId: exam.id } });
  });

  it("asks the general question when writing ended without the exam's", async () => {
    const { general, goal } = await examGoalFixture();

    await prisma.plan.update({
      data: { placementPreparedAt: new Date() },
      where: { goalId: goal.id },
    });

    await expect(readPlacement(goal.id)).resolves.toMatchObject({
      next: { itemId: general.id },
      status: "asking",
    });
  });

  it("gives session placement a general question even when the exam has one", async () => {
    const { blueprint, general, goal, skill, user } = await examGoalFixture();
    const other = await skillFixture();

    const [, otherGeneral] = await Promise.all([
      examItemFixture({ blueprintId: blueprint.id, skillId: skill.id }),
      itemFixture({ content: choiceItemContent(), skillId: other.id }),
    ]);

    const skills = [skill, other].map((node, index) => ({
      areaId: `phase:${index}`,
      areaTitle: `Phase ${index + 1}`,
      id: node.id,
      memberSkillIds: [node.id],
      order: index,
      phase: index,
      prerequisiteIds: [],
      removed: false,
      sectionTitle: null,
    }));

    const { placementItemIds: picked } = await pickSessionChecks({
      excludeItemIds: new Set(),
      goal: { details: {}, examBlueprintId: blueprint.id, id: goal.id },
      limit: 4,
      quickFormat: "multipleChoice",
      skills,
      userId: user.id,
    });

    expect(picked.toSorted()).toStrictEqual([general.id, otherGeneral.id].toSorted());
  });

  it("asks the subject worth most of the exam first, wherever the plan puts it", async () => {
    const [user, civil, ethics] = await Promise.all([
      userFixture(),
      skillFixture({ name: `Contratos ${crypto.randomUUID()}` }),
      skillFixture({ name: `Impedimentos ${crypto.randomUUID()}` }),
    ]);

    const citation = { passage: "passage", sourceId: "source" };

    const subject = (name: string) => ({
      citation,
      name,
      questions: null,
      topics: [],
      weight: null,
    });

    const blueprint = await examBlueprintFixture({
      name: "OAB",
      structure: {
        formats: [
          { citation, description: "Múltipla escolha", kind: "multipleChoice", options: null },
        ],
        mock: null,
        pastQuestions: {
          checkedAt: new Date().toISOString(),
          edition: null,
          source: { title: null, url: "https://example.com/oab" },
          subjects: [
            { name: "Direito Civil", questions: 6 },
            { name: "Ética Profissional", questions: 8 },
          ],
        },
        rules: [],
        subjects: [subject("Direito Civil"), subject("Ética Profissional")],
      },
    });

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Phase 1" }],
        skills: [graphSkill("Direito Civil", civil), graphSkill("Ética Profissional", ethics)],
      },
      placementPreparedAt: new Date(),
    });

    const [ethicsItem] = await Promise.all([
      examItemFixture({ blueprintId: blueprint.id, skillId: ethics.id }),
      examItemFixture({ blueprintId: blueprint.id, skillId: civil.id }),
      planItemFixture({ phase: 0, planId: plan.id, position: 0, skillId: civil.id }),
      planItemFixture({ phase: 0, planId: plan.id, position: 1, skillId: ethics.id }),
    ]);

    mockSession(user.id);

    await expect(readPlacement(goal.id)).resolves.toMatchObject({
      next: { itemId: ethicsItem.id },
    });
  });

  it("gives a session's placement question to the subject worth most of the exam first", async () => {
    const { blueprint, general, goal, skill, user } = await examGoalFixture();
    const ethics = await skillFixture();

    const [, ethicsItem] = await Promise.all([
      examItemFixture({ blueprintId: blueprint.id, skillId: skill.id }),
      examItemFixture({ blueprintId: blueprint.id, skillId: ethics.id }),
    ]);

    const skills = [
      { area: "Direito Civil", id: skill.id },
      { area: "Ética Profissional", id: ethics.id },
    ].map(({ area, id }, index) => ({
      areaId: "phase:0",
      areaTitle: "Phase 1",
      id,
      memberSkillIds: [id],
      order: index,
      phase: 0,
      prerequisiteIds: [],
      removed: false,
      sectionTitle: area,
    }));

    const pick = (areaShares: Map<string, number> | null) =>
      pickSessionChecks({
        areaShares,
        excludeItemIds: new Set(),
        goal: { details: {}, examBlueprintId: blueprint.id, id: goal.id },
        limit: 1,
        quickFormat: "multipleChoice",
        skills,
        userId: user.id,
      }).then(({ placementItemIds }) => placementItemIds);

    await expect(
      pick(
        new Map([
          ["Direito Civil", 0.4],
          ["Ética Profissional", 0.6],
        ]),
      ),
    ).resolves.toStrictEqual([ethicsItem.id]);

    await expect(pick(null)).resolves.toStrictEqual([general.id]);
  });

  it("accepts a general multiple-choice question for a true-or-false exam", async () => {
    const { blueprint, general, goal } = await examGoalFixture();

    await prisma.examBlueprint.update({
      data: {
        structure: {
          formats: [
            {
              citation: { passage: "Certo ou errado", sourceId: "notice" },
              description: "Certo ou errado",
              kind: "trueFalse",
              options: null,
            },
          ],
          mock: null,
          rules: [],
          subjects: [],
        },
      },
      where: { id: blueprint.id },
    });

    await expect(readPlacement(goal.id)).resolves.toMatchObject({
      next: { format: "multipleChoice", itemId: general.id },
    });
  });
});
