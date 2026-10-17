import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
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
  it("looks up an entrance exam goal's course weights once, marking the learner's plans changed, and the planner then reads them", async () => {
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

    const [revisionBefore, plan, otherPlan] = await Promise.all([
      readRevision(goal.userId),
      planFixture({ goalId: goal.id }),
      planFixture({ goalId: otherGoal.id }),
    ]);

    const readPlan = (planId = plan.id) =>
      prisma.plan.findUniqueOrThrow({ select: { inputVersion: true }, where: { id: planId } });

    await recordCourseWeights({ finding: FOUND, goalId: goal.id, lookup, provenance });
    await expect(readRevision(goal.userId)).resolves.toBe(revisionBefore + 1n);

    await expect(readPlan()).resolves.toStrictEqual({ inputVersion: plan.inputVersion + 1 });

    await expect(readPlan(otherPlan.id)).resolves.toStrictEqual({
      inputVersion: otherPlan.inputVersion + 1,
    });

    await Promise.all([
      copyStoredCourseWeights({ goalId: goal.id, lookup }),
      copyStoredCourseWeights({ goalId: goal.id, lookup }),
    ]);

    await expect(readRevision(goal.userId)).resolves.toBe(revisionBefore + 1n);
    await expect(readPlan()).resolves.toMatchObject({ inputVersion: plan.inputVersion + 1 });

    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    expect(readCourseWeights(saved.details)?.subjects).toStrictEqual([
      { name: "Ciências da Natureza", weight: 2 },
      { name: "Matemática", weight: 1 },
      { name: "Redação", weight: 2 },
    ]);

    // The learner's other answers stay, and the same course isn't looked up again.
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

    // Spelled their own way: the same course at the same institution.
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

async function readRevision(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return user.learnerRevision;
}
