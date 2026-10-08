import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { readCourseWeights } from "../plans/planner/course-weights";
import { findCourseWeightsLookup, recordCourseWeights } from "./course-weights-research";

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

async function enemGoal(details: Record<string, string>) {
  const [user, blueprint] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ name: "ENEM", structure }),
  ]);

  return goalFixture({
    details: { followUps: [], ...details },
    examBlueprintId: blueprint.id,
    kind: "exam",
    userId: user.id,
  });
}

describe(findCourseWeightsLookup, () => {
  it("looks up an entrance exam goal's course weights once, and the planner then reads them", async () => {
    const goal = await enemGoal({ institution: "UFMG", targetCourse: "Medicina" });
    const lookup = await findCourseWeightsLookup({ goalId: goal.id });

    expect(lookup).toStrictEqual({
      course: "Medicina",
      exam: "ENEM",
      institution: "UFMG",
      subjects: SUBJECTS,
    });

    await recordCourseWeights({
      finding: {
        edition: "SISU 2026",
        source: { title: "Pesos", url: "https://ufmg.br/pesos" },
        status: "found",
        weights: [2, 1, 2],
      },
      goalId: goal.id,
      lookup: lookup!,
    });

    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    expect(readCourseWeights(saved.details)?.subjects).toStrictEqual([
      { name: "Ciências da Natureza", weight: 2 },
      { name: "Matemática", weight: 1 },
      { name: "Redação", weight: 2 },
    ]);

    // The learner's other answers stay, and the same course isn't looked up again.
    expect(saved.details).toMatchObject({ followUps: [], institution: "UFMG" });
    await expect(findCourseWeightsLookup({ goalId: goal.id })).resolves.toBeNull();
  });

  it("remembers weights it couldn't find, and looks up again for another course", async () => {
    const goal = await enemGoal({ institution: "UFMG", targetCourse: "Medicina" });
    const lookup = await findCourseWeightsLookup({ goalId: goal.id });

    await recordCourseWeights({
      finding: { edition: null, source: null, status: "unknown", weights: [] },
      goalId: goal.id,
      lookup: lookup!,
    });

    await expect(findCourseWeightsLookup({ goalId: goal.id })).resolves.toBeNull();

    await prisma.goal.update({
      data: { details: { followUps: [], institution: "UFMG", targetCourse: "Direito" } },
      where: { id: goal.id },
    });

    await expect(findCourseWeightsLookup({ goalId: goal.id })).resolves.toMatchObject({
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

    await expect(findCourseWeightsLookup({ goalId: noInstitution.id })).resolves.toBeNull();
    await expect(findCourseWeightsLookup({ goalId: learnGoal.id })).resolves.toBeNull();
  });
});
