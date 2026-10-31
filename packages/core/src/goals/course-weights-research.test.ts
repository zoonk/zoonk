import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { holdLearnerLock, waitForBlockedStatement } from "../_test-utils/learner-lock";
import { mockSession } from "../_test-utils/mock-session";
import { recordGoalNoticeFormats } from "../library/exams/notice-formats";
import { planLibraryFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { readCourseWeights } from "../plans/planner/course-weights";
import { answerOnboardingQuestion } from "../view-models/onboarding/answer-onboarding-question";
import { type OnboardingAnswerInput } from "../view-models/onboarding/onboarding-contract";
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
  it.each<OnboardingAnswerInput>([
    { level: "basic", question: "level" },
    { question: "targetDate", targetDate: "2027-04-29" },
    { dailyMinutes: 25, question: "schedule" },
  ])("keeps research landing while the learner answers $question", async (input) => {
    const goal = await enemGoal({ institution: "UFMG", targetCourse: "Medicina" });

    const [library] = await Promise.all([
      planLibraryFixture({ skills: [{ lessons: 3 }] }),
      planFixture({ goalId: goal.id }),
    ]);

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(goal.userId);
    const lookup = await lookUp(goal.id);
    const held = holdLearnerLock({ userId: goal.userId });
    const pid = await held.pid;
    const weights = recordCourseWeights({ finding: FOUND, goalId: goal.id, lookup, provenance });
    const userLock = /FROM users[\s\S]*FOR (?:NO KEY )?UPDATE/u;
    await waitForBlockedStatement(pid, userLock);

    const formats = recordGoalNoticeFormats({
      documents: [{ sourceId: "notice", text: "The exam has five options per question." }],
      formats: [
        {
          count: null,
          countPassage: null,
          description: "Five choices",
          document: 1,
          entry: null,
          kind: "multipleChoice",
          markingPassage: null,
          options: 5,
          partialCredit: null,
          passage: "five options per question",
          sections: [],
          select: null,
        },
      ],
      goalId: goal.id,
    });

    await waitForBlockedStatement(pid, userLock, 2);
    const saving = answerOnboardingQuestion({ goalId: goal.id, input });

    try {
      await waitForBlockedStatement(pid, /FROM plans AS plan[\s\S]*FOR UPDATE/u);
    } finally {
      held.release();
      await Promise.all([held.done, weights, formats]);
    }

    await expect(saving).resolves.toMatchObject({ status: "saved" });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      details: {
        answered: [input.question],
        courseWeights: { status: "found" },
        institution: "UFMG",
        noticeFormats: expect.any(Array),
        targetCourse: "Medicina",
      },
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
