import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { pickPlacementItemSkills } from "../../lookahead/placement-item-skills";
import { askPlacement } from "../_test-utils/exam-test-goal";
import { loadSkillEvidence } from "../_utils/load-skill-claims";
import { applyPlacement } from "./_utils/apply-placement";
import { pickSessionPlacementItems } from "./_utils/session-placement-items";
import { answerPlacementQuestion } from "./answer-placement-question";

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
  it("keeps written skills out of question writing, placement picks, and objective evidence", async () => {
    const { blueprint, goal, skill: objective, user } = await examGoalFixture();
    const written = await skillFixture({ name: "Support an argument" });
    const writtenArea = "Written response";

    await Promise.all([
      prisma.examBlueprint.update({
        data: {
          structure: {
            formats: [
              {
                citation: { passage: "Write an answer", sourceId: "notice" },
                description: writtenArea,
                kind: "essay",
                options: null,
              },
            ],
            mock: null,
            rules: [],
            subjects: [],
          },
        },
        where: { id: blueprint.id },
      }),
      prisma.plan.update({
        data: {
          graph: {
            phases: [{ milestone: null, name: "Basics" }],
            skills: [
              graphSkill("Redação Oficial", objective),
              { ...graphSkill(writtenArea, written), outcome: true },
            ],
          },
        },
        where: { goalId: goal.id },
      }),
    ]);

    const needs = await pickPlacementItemSkills({
      goalId: goal.id,
      skillIds: [written.id, objective.id],
    });

    expect(needs.skills.map(({ id }) => id)).toStrictEqual([objective.id]);

    const [wrongBankItem, objectiveItem] = await Promise.all([
      examItemFixture({ blueprintId: blueprint.id, skillId: written.id }),
      examItemFixture({ blueprintId: blueprint.id, skillId: objective.id }),
    ]);

    await expect(
      answerPlacementQuestion({
        goalId: goal.id,
        input: {
          answer: { selectedIndex: 0 },
          durationMs: 1000,
          itemId: wrongBankItem.id,
          timeZone: "UTC",
        },
      }),
    ).resolves.toStrictEqual({ status: "invalidItem" });

    const skills = [written, objective].map((node, index) => ({
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

    await expect(
      pickSessionPlacementItems({
        excludeItemIds: new Set(),
        goal: { details: {}, examBlueprintId: blueprint.id, id: goal.id },
        limit: 4,
        quickFormat: "multipleChoice",
        skills,
        userId: user.id,
      }),
    ).resolves.toStrictEqual([objectiveItem.id]);

    const date = new Date("2026-11-20");

    await prisma.attempt.createMany({
      data: Array.from({ length: 3 }, () => ({
        answer: { pick: 0 },
        durationMs: 5000,
        hour: 12,
        isCorrect: true,
        isPlacement: true,
        itemId: wrongBankItem.id,
        localDate: date,
        skillId: written.id,
        userId: user.id,
        weekday: date.getUTCDay(),
      })),
    });

    const evidence = await loadSkillEvidence({
      goalId: goal.id,
      skillIds: [written.id],
      userId: user.id,
    });

    expect(evidence.claims.has(written.id)).toBe(false);
    expect(evidence.known.has(written.id)).toBe(false);

    const placed = await applyPlacement({
      goalId: goal.id,
      now: new Date(),
      timeZone: "UTC",
      userId: user.id,
    });

    expect(placed.state.knownSkillIds).not.toContain(written.id);
    expect(placed.testedOutPlanItemIds).toStrictEqual([]);
  });

  it("waits for the exam's question while it's written, then asks it over the general one", async () => {
    const { blueprint, goal, skill } = await examGoalFixture();

    await expect(readPlacement(goal.id)).resolves.toMatchObject({
      next: null,
      status: "waitingForQuestions",
    });

    const exam = await examItemFixture({ blueprintId: blueprint.id, skillId: skill.id });

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

  it("gives a session's placement questions from the exam's own, general ones only without them", async () => {
    const { blueprint, general, goal, skill, user } = await examGoalFixture();
    const other = await skillFixture();

    const [exam, otherGeneral] = await Promise.all([
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

    const picked = await pickSessionPlacementItems({
      excludeItemIds: new Set(),
      goal: { details: {}, examBlueprintId: blueprint.id, id: goal.id },
      limit: 4,
      quickFormat: "multipleChoice",
      skills,
      userId: user.id,
    });

    expect(picked.toSorted()).toStrictEqual([exam.id, otherGeneral.id].toSorted());
    expect(picked).not.toContain(general.id);
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
    const { blueprint, goal, skill, user } = await examGoalFixture();
    const ethics = await skillFixture();

    const [civilItem, ethicsItem] = await Promise.all([
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
      pickSessionPlacementItems({
        areaShares,
        excludeItemIds: new Set(),
        goal: { details: {}, examBlueprintId: blueprint.id, id: goal.id },
        limit: 1,
        quickFormat: "multipleChoice",
        skills,
        userId: user.id,
      });

    await expect(
      pick(
        new Map([
          ["Direito Civil", 0.4],
          ["Ética Profissional", 0.6],
        ]),
      ),
    ).resolves.toStrictEqual([ethicsItem.id]);

    await expect(pick(null)).resolves.toStrictEqual([civilItem.id]);
  });

  it("asks only questions in the exam's own format: its option count, its kind", async () => {
    const { blueprint, goal, skill } = await examGoalFixture();
    const citation = { passage: "passage", sourceId: "source" };

    const examFormat = (kind: "multipleChoice" | "trueFalse", options: number | null) => ({
      formats: [{ citation, description: "The exam's items", kind, options }],
      mock: null,
      rules: [],
      subjects: [],
    });

    const fiveOptions = {
      ...choiceItemContent("Five options?"),
      options: ["A", "B", "C", "D", "E"].map((text, index) => ({
        isCorrect: index === 0,
        misconception: null,
        reason: "Why",
        text,
      })),
    };

    const [twoOptions, five] = await Promise.all([
      examItemFixture({ blueprintId: blueprint.id, skillId: skill.id }),
      prisma.plan.update({ data: { placementPreparedAt: new Date() }, where: { goalId: goal.id } }),
      prisma.examBlueprint.update({
        data: { structure: examFormat("multipleChoice", 5) },
        where: { id: blueprint.id },
      }),
    ]).then(async ([written]) => [
      written,
      await itemFixture({ content: fiveOptions, examBlueprintId: blueprint.id, skillId: skill.id }),
    ]);

    await expect(readPlacement(goal.id)).resolves.toMatchObject({ next: { itemId: five?.id } });

    await Promise.all([
      prisma.item.delete({ where: { id: five?.id } }),
      prisma.examBlueprint.update({
        data: { structure: examFormat("trueFalse", null) },
        where: { id: blueprint.id },
      }),
    ]);

    const placement = await readPlacement(goal.id);
    expect(placement?.next?.itemId).not.toBe(twoOptions?.id);
  });

  it("asks only the options the exam's latest edition had when its notice doesn't say", async () => {
    const { blueprint, general, goal, skill } = await examGoalFixture();
    const citation = { passage: "180 questões objetivas", sourceId: "source" };

    const fiveOptions = {
      ...choiceItemContent("Five options?"),
      options: ["A", "B", "C", "D", "E"].map((text, index) => ({
        isCorrect: index === 0,
        misconception: null,
        reason: "Why",
        text,
      })),
    };

    await Promise.all([
      prisma.plan.update({ data: { placementPreparedAt: new Date() }, where: { goalId: goal.id } }),
      prisma.examBlueprint.update({
        data: {
          structure: {
            formats: [
              { citation, description: "Objetivas", kind: "multipleChoice", options: null },
            ],
            mock: null,
            pastOptions: {
              checkedAt: "2026-10-07T00:00:00.000Z",
              edition: "Enem 2025",
              options: 5,
              source: { title: null, url: "https://www.gov.br/inep" },
            },
            rules: [],
            subjects: [],
          },
        },
        where: { id: blueprint.id },
      }),
    ]);

    const waiting = await readPlacement(goal.id);
    expect(waiting?.next?.itemId).not.toBe(general.id);

    const five = await itemFixture({
      content: fiveOptions,
      examBlueprintId: blueprint.id,
      skillId: skill.id,
    });

    await expect(readPlacement(goal.id)).resolves.toMatchObject({ next: { itemId: five.id } });
  });
});
