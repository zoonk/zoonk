import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import {
  ENGLISH,
  FOREIGN,
  FOREIGN_LANGUAGE,
  FRENCH,
  HISTORY,
  LANGUAGES,
  MATH,
  PHILOSOPHY,
  SOFTWARE,
  SPANISH,
  SPECIALTY,
  choiceBlueprintFixture,
  specialtyBlueprintFixture,
  twoChoiceBlueprintFixture,
} from "../../exams/choices/_test-utils/choice-blueprint";
import { unplannedGoalFixture } from "../../plans/_test-utils/plan-library";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { answerOnboardingQuestion } from "./answer-onboarding-question";
import { getOnboarding } from "./get-onboarding";

async function setup() {
  const user = await userFixture();
  const blueprint = await choiceBlueprintFixture();

  const { goal, plan } = await unplannedGoalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    userId: user.id,
  });

  mockSession(user.id);
  return { goal, plan };
}

async function specialtyGoal(prompt: string, details: object = {}) {
  const user = await userFixture();
  const blueprint = await specialtyBlueprintFixture();

  const { goal, plan } = await unplannedGoalFixture({
    details,
    examBlueprintId: blueprint.id,
    kind: "exam",
    language: "pt",
    prompt,
    userId: user.id,
  });

  mockSession(user.id);
  return { goal, plan };
}

async function loadOnboarding(goalId: string) {
  const result = await getOnboarding({ goalId });

  if (result.status !== "ready") {
    throw new Error(`Onboarding isn't ready: ${result.status}`);
  }

  return result.onboarding;
}

async function loadChoices(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  return parsePlanSettings(plan.settings).examChoices;
}

describe("onboarding an exam with a choice", () => {
  it("asks which option the learner takes, and counts neither before they pick", async () => {
    const { goal } = await setup();
    const onboarding = await loadOnboarding(goal.id);

    expect(onboarding.steps).toContain("examChoice");

    expect(onboarding.examChoices).toStrictEqual([
      {
        group: FOREIGN,
        leftOut: { examPoints: null, examQuestions: 90, name: FOREIGN, points: null, questions: 5 },
        options: [
          { name: ENGLISH, shortName: "Inglês" },
          { name: SPANISH, shortName: "Espanhol" },
        ],
        subject: null,
      },
    ]);

    expect(onboarding.examSubjects.map((subject) => subject.name)).toStrictEqual([LANGUAGES, MATH]);
  });

  it("keeps the pick with the plan and lists only that option from then on", async () => {
    const { goal, plan } = await setup();

    await expect(
      answerOnboardingQuestion({
        goalId: goal.id,
        input: { choices: [{ group: FOREIGN, subject: SPANISH }], question: "examChoice" },
      }),
    ).resolves.toStrictEqual({ movedTo: null, status: "saved" });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([
      { group: FOREIGN, subject: SPANISH },
    ]);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion + 1,
    });

    const onboarding = await loadOnboarding(goal.id);

    expect(onboarding.steps).not.toContain("examChoice");
    expect(onboarding.examChoices[0]?.subject).toBe(SPANISH);

    expect(onboarding.examSubjects.map((subject) => subject.name)).toStrictEqual([
      LANGUAGES,
      SPANISH,
      MATH,
    ]);
  });

  it("leaves the choice for the plan when the learner decides later, and doesn't ask again", async () => {
    const { goal, plan } = await setup();

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { choices: null, question: "examChoice" },
    });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([]);

    await expect(loadOnboarding(goal.id)).resolves.not.toMatchObject({
      steps: expect.arrayContaining(["examChoice"]),
    });
  });

  it("refuses an option the exam doesn't offer and asks again", async () => {
    const { goal, plan } = await setup();

    await expect(
      answerOnboardingQuestion({
        goalId: goal.id,
        input: {
          choices: [{ group: FOREIGN, subject: "Língua Francesa" }],
          question: "examChoice",
        },
      }),
    ).resolves.toStrictEqual({ status: "invalid" });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([]);

    await expect(loadOnboarding(goal.id)).resolves.toMatchObject({
      steps: expect.arrayContaining(["examChoice"]),
    });
  });

  it("takes the specialty the learner's stated position names without asking, and saves it with their next answer", async () => {
    const { goal, plan } = await specialtyGoal("passar no concurso da CGU para auditor de TI", {
      targetPosition: "Auditor de TI, desenvolvimento de sistemas",
    });

    const onboarding = await loadOnboarding(goal.id);

    expect(onboarding.steps).not.toContain("examChoice");
    expect(onboarding.examChoices).toMatchObject([{ group: SPECIALTY, subject: SOFTWARE }]);
    expect(onboarding.examSubjects.map((subject) => subject.name)).toContain(SOFTWARE);
    await expect(loadChoices(plan.id)).resolves.toStrictEqual([]);

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { level: "basic", question: "level" },
    });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([
      { group: SPECIALTY, subject: SOFTWARE },
    ]);
  });

  // The goal reading records no position for these, so only the goal's own words name an option.
  it.each([
    "Passar na CGU, preciso estudar os dados do edital",
    "Passar na CGU e aprender ciência de dados",
    "CGU, possivelmente Auditoria",
    "passar no concurso da CGU, não quero Auditoria",
  ])("asks which specialty for %j", async (prompt) => {
    const { goal } = await specialtyGoal(prompt);
    const onboarding = await loadOnboarding(goal.id);

    expect(onboarding.steps).toContain("examChoice");
    expect(onboarding.examChoices).toMatchObject([{ group: SPECIALTY, subject: null }]);
  });

  it("takes the specialty from the position the learner types in onboarding", async () => {
    const { goal, plan } = await specialtyGoal("passar no concurso da CGU", {
      examTarget: "position",
    });

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { question: "target", target: "Auditor Federal – Desenvolvimento de Sistemas" },
    });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([
      { group: SPECIALTY, subject: SOFTWARE },
    ]);

    await expect(loadOnboarding(goal.id)).resolves.not.toMatchObject({
      steps: expect.arrayContaining(["examChoice"]),
    });
  });

  it("never picks for a learner who chose to decide later", async () => {
    const { goal, plan } = await specialtyGoal("passar no concurso da CGU", {
      followUps: [{ question: "Qual área?" }],
    });

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { choices: null, question: "examChoice" },
    });

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { answers: ["Desenvolvimento de Sistemas"], question: "followUps" },
    });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([]);
  });

  it("asks every choice of any exam and keeps each pick on its own", async () => {
    const user = await userFixture();
    const blueprint = await twoChoiceBlueprintFixture();

    const { goal, plan } = await unplannedGoalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      language: "es",
      userId: user.id,
    });

    mockSession(user.id);

    await expect(loadOnboarding(goal.id)).resolves.toMatchObject({
      examChoices: [
        { group: HISTORY, subject: null },
        { group: FOREIGN_LANGUAGE, subject: null },
      ],
    });

    const picks = [
      { group: HISTORY, subject: PHILOSOPHY },
      { group: FOREIGN_LANGUAGE, subject: FRENCH },
    ];

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { choices: picks, question: "examChoice" },
    });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual(picks);

    const onboarding = await loadOnboarding(goal.id);

    expect(onboarding.examSubjects.map((subject) => subject.name)).toStrictEqual([
      "Lengua Castellana y Literatura II",
      PHILOSOPHY,
      FRENCH,
    ]);
  });
});
