import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { setGoalPrimaryCourse } from "../library/curriculum/goal-primary-course";
import { commitPlan } from "../plans/_utils/commit-plan";
import { loadPlanContext } from "../plans/_utils/plan-context";
import { computePlan } from "../plans/_utils/replan";
import { withPlanRetry } from "../plans/plan-conflict";
import { readCourseWeights } from "../plans/planner/course-weights";
import {
  copyStoredCourseWeights,
  findCourseWeightsLookup,
  recordCourseWeights,
} from "./course-weights-research";

const citation = { passage: "…", sourceId: "notice" };

function subject(name: string) {
  return { citation, group: null, name, questions: 45, shortName: null, topics: [], weight: null };
}

const structure = {
  formats: [{ citation, description: "Cinco opções", kind: "multipleChoice", options: 5 }],
  mock: null,
  rules: [],
  subjects: [subject("Ciências da Natureza"), subject("Matemática"), subject("Redação")],
};

const SUBJECTS = ["Ciências da Natureza", "Matemática", "Redação"];

const YEAR = 2026;

const provenance = { model: "google/gemini-3.8-flash", promptVersion: "v1", runId: "run" };

const FOUND = {
  edition: "SISU 2026",
  source: { title: "Pesos", url: "https://ufmg.br/pesos" },
  status: "found" as const,
  weights: [2, 1, 2],
};

async function enemGoal(details: Record<string, string>, examBlueprintId?: string) {
  const [user, blueprint] = await Promise.all([
    userFixture(),
    examBlueprintId ? null : examBlueprintFixture({ name: "ENEM", structure }),
  ]);

  return goalFixture({
    details: { followUps: [], ...details },
    examBlueprintId: examBlueprintId ?? blueprint?.id,
    kind: "exam",
    userId: user.id,
  });
}

async function lookUp(goalId: string, year = YEAR) {
  const lookup = await findCourseWeightsLookup({ goalId, year });

  if (!lookup) {
    throw new Error("The goal has nothing to look up.");
  }

  return lookup;
}

describe(findCourseWeightsLookup, () => {
  it("looks up an entrance exam goal's course weights once, marking only that goal's plan changed, and the planner then reads them", async () => {
    const goal = await enemGoal({ institution: "UFMG", targetCourse: "Medicina" });
    const lookup = await lookUp(goal.id);

    expect(lookup).toStrictEqual({
      course: "Medicina",
      exam: "ENEM",
      examBlueprintId: goal.examBlueprintId,
      institution: "UFMG",
      key: "course:medicina|ufmg",
      subjects: SUBJECTS,
      year: YEAR,
    });

    await expect(copyStoredCourseWeights({ goalId: goal.id, lookup })).resolves.toBe(false);

    const otherGoal = await goalFixture({ userId: goal.userId });

    const [plan, otherPlan] = await Promise.all([
      planFixture({ goalId: goal.id }),
      planFixture({ goalId: otherGoal.id }),
    ]);

    const readPlan = (planId = plan.id) =>
      prisma.plan.findUniqueOrThrow({ select: { inputVersion: true }, where: { id: planId } });

    await recordCourseWeights({ finding: FOUND, goalId: goal.id, lookup, provenance });

    await expect(readPlan()).resolves.toStrictEqual({ inputVersion: plan.inputVersion + 1 });

    await expect(readPlan(otherPlan.id)).resolves.toStrictEqual({
      inputVersion: otherPlan.inputVersion,
    });

    await Promise.all([
      copyStoredCourseWeights({ goalId: goal.id, lookup }),
      copyStoredCourseWeights({ goalId: goal.id, lookup }),
    ]);

    await expect(readPlan()).resolves.toMatchObject({ inputVersion: plan.inputVersion + 1 });

    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    expect(readCourseWeights(saved.details)?.subjects).toStrictEqual([
      { name: "Ciências da Natureza", weight: 2 },
      { name: "Matemática", weight: 1 },
      { name: "Redação", weight: 2 },
    ]);

    expect(saved.details).toMatchObject({ followUps: [], institution: "UFMG" });
    await expect(findCourseWeightsLookup({ goalId: goal.id, year: YEAR })).resolves.toBeNull();
  });

  it("remembers weights it couldn't find, and looks up again for another course", async () => {
    const goal = await enemGoal({ institution: "UFMG", targetCourse: "Medicina" });

    await recordCourseWeights({
      finding: { edition: null, source: null, status: "unknown", weights: [] },
      goalId: goal.id,
      lookup: await lookUp(goal.id),
      provenance,
    });

    await expect(findCourseWeightsLookup({ goalId: goal.id, year: YEAR })).resolves.toBeNull();

    await prisma.goal.update({
      data: { details: { followUps: [], institution: "UFMG", targetCourse: "Direito" } },
      where: { id: goal.id },
    });

    await expect(findCourseWeightsLookup({ goalId: goal.id, year: YEAR })).resolves.toMatchObject({
      course: "Direito",
    });
  });

  it("needs a course and an institution, and an exam's shared notice", async () => {
    const [noInstitution, user] = await Promise.all([
      enemGoal({ targetCourse: "Medicina" }),
      userFixture(),
    ]);

    const learnGoal = await goalFixture({
      details: { institution: "UFMG", targetCourse: "Medicina" },
      userId: user.id,
    });

    await expect(
      findCourseWeightsLookup({ goalId: noInstitution.id, year: YEAR }),
    ).resolves.toBeNull();

    await expect(findCourseWeightsLookup({ goalId: learnGoal.id, year: YEAR })).resolves.toBeNull();
  });
});

describe(copyStoredCourseWeights, () => {
  it("gives the next learner aiming at the same course the weights, after the first learner leaves", async () => {
    const first = await enemGoal({ institution: "UFMG", targetCourse: "Medicina" });
    const examBlueprintId = first.examBlueprintId ?? "";

    await recordCourseWeights({
      finding: FOUND,
      goalId: first.id,
      lookup: await lookUp(first.id),
      provenance,
    });

    await prisma.user.delete({ where: { id: first.userId } });

    const next = await enemGoal({ institution: "ufmg", targetCourse: "medicina" }, examBlueprintId);

    await expect(
      copyStoredCourseWeights({ goalId: next.id, lookup: await lookUp(next.id) }),
    ).resolves.toBe(true);

    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: next.id } });

    expect(readCourseWeights(saved.details)).toMatchObject({
      course: "medicina",
      edition: "SISU 2026",
      institution: "ufmg",
      source: { title: "Pesos", url: "https://ufmg.br/pesos" },
      subjects: [
        { name: "Ciências da Natureza", weight: 2 },
        { name: "Matemática", weight: 1 },
        { name: "Redação", weight: 2 },
      ],
    });

    await expect(findCourseWeightsLookup({ goalId: next.id, year: YEAR })).resolves.toBeNull();
  });

  it("shares weights nobody found for the year, and looks them up again the next year", async () => {
    const first = await enemGoal({ institution: "USP", targetCourse: "Direito" });
    const examBlueprintId = first.examBlueprintId ?? "";

    await recordCourseWeights({
      finding: { edition: null, source: null, status: "unknown", weights: [] },
      goalId: first.id,
      lookup: await lookUp(first.id),
      provenance,
    });

    const next = await enemGoal({ institution: "USP", targetCourse: "Direito" }, examBlueprintId);

    await expect(
      copyStoredCourseWeights({ goalId: next.id, lookup: await lookUp(next.id) }),
    ).resolves.toBe(true);

    await expect(findCourseWeightsLookup({ goalId: next.id, year: YEAR })).resolves.toBeNull();

    const later = await enemGoal({ institution: "USP", targetCourse: "Direito" }, examBlueprintId);

    await expect(
      copyStoredCourseWeights({ goalId: later.id, lookup: await lookUp(later.id, YEAR + 1) }),
    ).resolves.toBe(false);
  });

  it("keeps the first lookup's weights when two learners' lookups land at once", async () => {
    const first = await enemGoal({ institution: "UFRJ", targetCourse: "Medicina" });

    const second = await enemGoal(
      { institution: "UFRJ", targetCourse: "Medicina" },
      first.examBlueprintId ?? "",
    );

    const [firstLookup, secondLookup] = await Promise.all([lookUp(first.id), lookUp(second.id)]);

    await recordCourseWeights({
      finding: FOUND,
      goalId: first.id,
      lookup: firstLookup,
      provenance,
    });

    await recordCourseWeights({
      finding: { ...FOUND, weights: [1, 3, 1] },
      goalId: second.id,
      lookup: secondLookup,
      provenance,
    });

    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: second.id } });

    expect(readCourseWeights(saved.details)?.subjects.map((part) => part.weight)).toStrictEqual([
      2, 1, 2,
    ]);
  });
});

describe("background plan inputs", () => {
  it("outlasts a primary course and weights landing in successive plan attempts", async () => {
    const goal = await enemGoal({ institution: "UFMG", targetCourse: "Medicina" });
    const [course, plan] = await Promise.all([courseFixture(), planFixture({ goalId: goal.id })]);
    const lookup = await lookUp(goal.id);
    let attempts = 0;

    const saving = withPlanRetry(async () => {
      attempts += 1;
      const current = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
      const context = await loadPlanContext({ goal: current });
      expect(context).not.toBeNull();
      const computed = await computePlan({ context: context!, mode: "automatic" });

      if (attempts === 1) {
        await setGoalPrimaryCourse({ courseId: course.id, goalId: goal.id });
      }

      if (attempts === 2) {
        await recordCourseWeights({ finding: FOUND, goalId: goal.id, lookup, provenance });
      }

      return commitPlan({ change: null, computed, context: context! });
    });

    await expect(saving).resolves.toBeNull();
    expect(attempts).toBe(3);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion + 3,
      version: plan.version + 1,
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      details: { courseWeights: { status: "found" } },
      primaryCourseId: course.id,
    });
  });

  it("ignores a completed weights lookup for a target the learner has replaced", async () => {
    const goal = await enemGoal({ institution: "UFMG", targetCourse: "Medicina" });
    const lookup = await lookUp(goal.id);
    const plan = await planFixture({ goalId: goal.id });

    await prisma.goal.update({
      data: { details: { institution: "UFMG", targetCourse: "Direito" } },
      where: { id: goal.id },
    });

    await recordCourseWeights({ finding: FOUND, goalId: goal.id, lookup, provenance });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      details: { institution: "UFMG", targetCourse: "Direito" },
    });

    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(readCourseWeights(saved.details)).toBeNull();

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion,
    });
  });
});
