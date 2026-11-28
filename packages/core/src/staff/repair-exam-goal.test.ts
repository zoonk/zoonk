import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  FOREIGN,
  SPANISH,
  choiceBlueprintFixture,
} from "../exams/choices/_test-utils/choice-blueprint";
import { unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { repairExamGoal } from "./repair-exam-goal";

const actor = { clientId: "zoonk-cli", userId: "staff" };

async function revealedExamGoal() {
  const user = await userFixture();

  const goal = await goalFixture({
    details: { answered: ["level", "schedule"], examDay: "booked" },
    kind: "exam",
    planRevealedAt: new Date(),
    prompt: "study for my ground school exams, to be a licensed private pilot in canada",
    userId: user.id,
  });

  const plan = await planFixture({ goalId: goal.id });

  const finished = await planItemFixture({
    completedAt: new Date(),
    planId: plan.id,
    status: "done",
  });

  return { finished, goal };
}

describe(repairExamGoal, () => {
  it("previews a country without writing anything", async () => {
    const { goal } = await revealedExamGoal();

    await expect(
      repairExamGoal({ actor, apply: false, country: "CA", goalId: goal.id }),
    ).resolves.toStrictEqual({
      after: { contentCountry: "CA", examChoices: [] },
      before: { contentCountry: null, examChoices: [] },
      status: "preview",
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      contentCountry: null,
      details: goal.details,
    });

    await expect(prisma.followUp.count({ where: { key: goal.id } })).resolves.toBe(0);
  });

  it("saves the country as the learner's answer on a goal read before exams recorded it, keeping finished work", async () => {
    const { finished, goal } = await revealedExamGoal();

    await expect(
      repairExamGoal({ actor, apply: true, country: "CA", goalId: goal.id }),
    ).resolves.toMatchObject({
      after: { contentCountry: "CA" },
      before: { contentCountry: null },
      status: "applied",
    });

    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    expect(saved).toMatchObject({
      contentCountry: "CA",
      details: { answered: ["level", "schedule", "contentCountry"], countryDependent: true },
    });

    await expect(
      prisma.followUp.findMany({
        orderBy: { kind: "asc" },
        select: { kind: true },
        where: { key: goal.id },
      }),
    ).resolves.toStrictEqual([{ kind: "rebuildGoalCurriculum" }, { kind: "researchGoal" }]);

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: finished.id } }),
    ).resolves.toMatchObject({ status: "done" });
  });

  it("saves an option the exam offers and refuses one it doesn't", async () => {
    const [user, blueprint] = await Promise.all([userFixture(), choiceBlueprintFixture()]);

    const { goal, plan } = await unplannedGoalFixture({
      details: { answered: [] },
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    await expect(
      repairExamGoal({
        actor,
        apply: true,
        choices: [{ group: FOREIGN, subjects: ["Klingon"] }],
        goalId: goal.id,
      }),
    ).resolves.toStrictEqual({ status: "invalid" });

    await expect(
      repairExamGoal({
        actor,
        apply: true,
        choices: [{ group: FOREIGN, subjects: [SPANISH] }],
        goalId: goal.id,
      }),
    ).resolves.toMatchObject({
      after: { examChoices: [{ group: FOREIGN, subjects: [SPANISH] }] },
      before: { examChoices: [] },
      status: "applied",
    });

    const settings = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(parsePlanSettings(settings.settings).examChoices).toStrictEqual([
      { group: FOREIGN, subjects: [SPANISH] },
    ]);
  });

  it("finds no goal that isn't an active exam", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ kind: "learn", userId: user.id });

    await expect(
      repairExamGoal({ actor, apply: true, country: "CA", goalId: goal.id }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
