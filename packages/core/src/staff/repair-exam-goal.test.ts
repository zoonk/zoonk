import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  ENGLISH,
  FOREIGN,
  FOREIGN_LANGUAGE,
  FRENCH,
  HISTORY,
  PHILOSOPHY,
  SPANISH,
  choiceBlueprintFixture,
  twoChoiceBlueprintFixture,
} from "../exams/choices/_test-utils/choice-blueprint";
import { unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { repairExamGoal } from "./repair-exam-goal";

const actor = { clientId: "zoonk-cli", userId: "staff" };

async function revealedExamGoal(attrs: Partial<Parameters<typeof goalFixture>[0]> = {}) {
  const user = await userFixture();

  const goal = await goalFixture({
    details: { answered: ["level", "schedule"], examDay: "booked" },
    kind: "exam",
    planRevealedAt: new Date(),
    prompt: "study for my ground school exams, to be a licensed private pilot in canada",
    userId: user.id,
    ...attrs,
  });

  const plan = await planFixture({ goalId: goal.id });

  const finished = await planItemFixture({
    completedAt: new Date(),
    planId: plan.id,
    status: "done",
  });

  return { finished, goal };
}

function owedFollowUps(goalId: string) {
  return prisma.followUp.findMany({
    orderBy: { kind: "asc" },
    select: { kind: true },
    where: { key: goalId },
  });
}

async function choiceGoal(settings: object = {}) {
  const [user, blueprint] = await Promise.all([userFixture(), choiceBlueprintFixture()]);

  return unplannedGoalFixture({
    details: { answered: [] },
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings,
    userId: user.id,
  });
}

async function loadChoices(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  return parsePlanSettings(plan.settings).examChoices;
}

describe(repairExamGoal, () => {
  it("previews a country without writing anything", async () => {
    const { goal } = await revealedExamGoal();

    await expect(
      repairExamGoal({ actor, answer: { country: "CA" }, apply: false, goalId: goal.id }),
    ).resolves.toStrictEqual({
      after: { contentCountry: "CA", examChoices: [] },
      before: { contentCountry: null, examChoices: [] },
      status: "preview",
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      contentCountry: null,
      details: goal.details,
    });

    await expect(owedFollowUps(goal.id)).resolves.toStrictEqual([]);
  });

  it("saves the country as the learner's answer on a goal read before exams recorded it, keeping finished work", async () => {
    const { finished, goal } = await revealedExamGoal();

    await expect(
      repairExamGoal({ actor, answer: { country: "CA" }, apply: true, goalId: goal.id }),
    ).resolves.toMatchObject({
      after: { contentCountry: "CA" },
      before: { contentCountry: null },
      status: "applied",
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      contentCountry: "CA",
      details: { answered: ["level", "schedule", "contentCountry"], countryDependent: true },
    });

    await expect(owedFollowUps(goal.id)).resolves.toStrictEqual([
      { kind: "rebuildGoalCurriculum" },
      { kind: "researchGoal" },
    ]);

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: finished.id } }),
    ).resolves.toMatchObject({ status: "done" });
  });

  it("reports a repeated apply as unchanged and owes its work once", async () => {
    const { goal } = await revealedExamGoal();

    const apply = () =>
      repairExamGoal({ actor, answer: { country: "CA" }, apply: true, goalId: goal.id });

    const results = await Promise.all([apply(), apply(), apply()]);

    expect(results.filter(({ status }) => status === "applied")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "unchanged")).toHaveLength(2);

    await expect(
      prisma.followUp.findMany({ select: { revision: true }, where: { key: goal.id } }),
    ).resolves.toStrictEqual([{ revision: 0 }, { revision: 0 }]);
  });

  it("rebuilds for a first country that matches the goal language's own country", async () => {
    const { goal } = await revealedExamGoal({ language: "en" });

    await repairExamGoal({ actor, answer: { country: "US" }, apply: true, goalId: goal.id });

    await expect(owedFollowUps(goal.id)).resolves.toStrictEqual([
      { kind: "rebuildGoalCurriculum" },
      { kind: "researchGoal" },
    ]);
  });

  it("leaves a country the learner already gave, and refuses one for an exam read as the same everywhere", async () => {
    const answered = await revealedExamGoal({ contentCountry: "AU" });

    const sameEverywhere = await revealedExamGoal({
      details: { answered: [], countryDependent: false },
    });

    await expect(
      repairExamGoal({ actor, answer: { country: "CA" }, apply: true, goalId: answered.goal.id }),
    ).resolves.toStrictEqual({ status: "conflict" });

    await expect(
      repairExamGoal({ actor, answer: { country: "AU" }, apply: true, goalId: answered.goal.id }),
    ).resolves.toMatchObject({ status: "unchanged" });

    await expect(
      repairExamGoal({
        actor,
        answer: { country: "CA" },
        apply: true,
        goalId: sameEverywhere.goal.id,
      }),
    ).resolves.toStrictEqual({ status: "invalid" });

    await expect(
      prisma.goal.findMany({
        orderBy: { contentCountry: "asc" },
        select: { contentCountry: true },
        where: { id: { in: [answered.goal.id, sameEverywhere.goal.id] } },
      }),
    ).resolves.toStrictEqual([{ contentCountry: "AU" }, { contentCountry: null }]);

    await expect(owedFollowUps(answered.goal.id)).resolves.toStrictEqual([]);
  });

  it("saves an option the exam offers and refuses one it doesn't", async () => {
    const { goal, plan } = await choiceGoal();

    await expect(
      repairExamGoal({
        actor,
        answer: { choice: { group: FOREIGN, subjects: ["Klingon"] } },
        apply: true,
        goalId: goal.id,
      }),
    ).resolves.toStrictEqual({ status: "invalid" });

    await expect(
      repairExamGoal({
        actor,
        answer: { choice: { group: FOREIGN, subjects: [SPANISH] } },
        apply: true,
        goalId: goal.id,
      }),
    ).resolves.toMatchObject({
      after: { examChoices: [{ group: FOREIGN, subjects: [SPANISH] }] },
      before: { examChoices: [] },
      status: "applied",
    });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([
      { group: FOREIGN, subjects: [SPANISH] },
    ]);
  });

  it("never replaces an option the learner picked", async () => {
    const { goal, plan } = await choiceGoal({
      examChoices: [{ group: FOREIGN, subjects: [ENGLISH] }],
    });

    await expect(
      repairExamGoal({
        actor,
        answer: { choice: { group: FOREIGN, subjects: [SPANISH] } },
        apply: true,
        goalId: goal.id,
      }),
    ).resolves.toStrictEqual({ status: "conflict" });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([
      { group: FOREIGN, subjects: [ENGLISH] },
    ]);
  });

  it("previews an option beside the learner's other picks", async () => {
    const [user, blueprint] = await Promise.all([userFixture(), twoChoiceBlueprintFixture()]);
    const history = { group: HISTORY, subjects: [PHILOSOPHY] };
    const language = { group: FOREIGN_LANGUAGE, subjects: [FRENCH] };

    const { goal } = await unplannedGoalFixture({
      details: { answered: [] },
      examBlueprintId: blueprint.id,
      kind: "exam",
      settings: { examChoices: [history] },
      userId: user.id,
    });

    await expect(
      repairExamGoal({ actor, answer: { choice: language }, apply: false, goalId: goal.id }),
    ).resolves.toMatchObject({
      after: { examChoices: [history, language] },
      before: { examChoices: [history] },
      status: "preview",
    });
  });

  it("finds no goal that isn't an active exam", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ kind: "learn", userId: user.id });

    await expect(
      repairExamGoal({ actor, answer: { country: "CA" }, apply: true, goalId: goal.id }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
