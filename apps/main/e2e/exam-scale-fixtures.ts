import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY } from "@zoonk/utils/date";

/** Exams scored on their own scale or by their own guidelines: the SAT's 400 to 1600, AP's points. */

/** The SAT scores with item response theory, on its own 400 to 1600 scale. */
const SAT_STRUCTURE = {
  formats: ["multipleChoice"],
  mock: {
    adaptive: true,
    citations: [],
    order: null,
    scoring: { description: "Item response theory", method: "itemResponseTheory" },
    sections: [],
    timeLimitMinutes: 134,
    totalQuestions: 98,
  },
  rules: [],
  subjects: [],
};

/**
 * A learner whose SAT was yesterday, with one mock before it: 30 of 40 right, which the estimate
 * reads as 1170 to 1430 on the SAT's scale.
 */
export async function createSatExamAfterMock() {
  const [user, blueprint] = await Promise.all([
    createE2EUser(getBaseURL()),
    examBlueprintFixture({ name: "SAT", structure: SAT_STRUCTURE }),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    prompt: "I want a good SAT score",
    targetDate: new Date(Date.now() - MS_PER_DAY),
    timezone: "UTC",
    title: "SAT",
    userId: user.id,
  });

  const mockDay = new Date(Date.now() - 3 * MS_PER_DAY);

  await Promise.all([
    planFixture({ goalId: goal.id }),
    // The mock as the exam screen lists it, and its answers as the ledger counts them.
    prisma.mockExam.create({
      data: {
        conditions: {},
        finishedAt: mockDay,
        goalId: goal.id,
        result: {
          areas: [],
          blank: 0,
          calibration: null,
          coherence: null,
          correct: 30,
          irt: null,
          minutesUsed: 120,
          net: null,
          plannedMinutes: 134,
          preparation: null,
          previous: null,
          scoring: "raw",
          total: 40,
          unansweredAtTimeout: 0,
        },
        sectionStartedAt: mockDay,
        status: "finished",
        userId: user.id,
      },
    }),
    learningEventFixture({
      correctAnswers: 30,
      endedAt: mockDay,
      goalId: goal.id,
      incorrectAnswers: 10,
      kind: "mock",
      userId: user.id,
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  return { user };
}

const AP_ROWS = [
  { criterion: "(a) Variable", description: "Identifies temperature", points: 1 },
  { criterion: "(b) Trend", description: "Describes the rise in rate", points: 1 },
  {
    criterion: "(c) Explanation",
    description: "Explains denaturation and the active site",
    points: 2,
  },
  {
    criterion: "(d) Prediction",
    description: "Predicts and justifies the inhibitor's effect",
    points: 2,
  },
];

const AP_ROW_SCORES = [1, 1, 0, 1];

/**
 * An AP Biology learner with a free-response question open in today's writing block and one draft
 * graded by its rows' own points, stored the way grading stores it (tests don't call the model).
 */
export async function createApFreeResponseDay() {
  const [user, skill, blueprint] = await Promise.all([
    createE2EUser(getBaseURL()),
    skillFixture({ name: `Enzyme activity ${randomUUID()}` }),
    examBlueprintFixture({ identityKey: `ap-biology-${randomUUID()}`, name: "AP Biology" }),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: "UTC",
    title: "AP Biology",
    userId: user.id,
  });

  const [item, session] = await Promise.all([
    itemFixture({
      content: {
        context: "A student measures an enzyme's rate at five temperatures.",
        keyPoints: ["Explains denaturation"],
        question:
          "(a) Identify the independent variable. (b) Describe the trend. (c) Explain the drop above 45 °C. (d) Predict the effect of a competitive inhibitor.",
        rubric: AP_ROWS,
        sampleOutline: "(a) Temperature. (b) Rises. (c) Denaturation. (d) Slower.",
      },
      examBlueprintId: blueprint.id,
      format: "essay",
      skillId: skill.id,
    }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    planFixture({ goalId: goal.id }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  const block = await studySessionBlockFixture({
    estimatedMinutes: 20,
    kind: "produce",
    payload: { itemIds: [item.id], skillIds: [skill.id], title: "Enzyme activity" },
    sessionId: session.id,
    startedAt: new Date(),
    status: "active",
  });

  await prisma.attempt.create({
    data: {
      answer: {
        grade: {
          criteria: AP_ROWS.map((row, index) => ({
            comment: `Comment on part ${index + 1}.`,
            example:
              index === 2
                ? "High heat denatures the enzyme, so the active site changes shape."
                : null,
            id: `criterion-${index + 1}`,
            maxScore: row.points,
            name: row.criterion,
            quote: null,
            score: AP_ROW_SCORES[index] ?? 0,
          })),
          enemInterventionElements: null,
          nextStep: { criterionId: "criterion-3", text: "Name denaturation and the active site." },
          range: { high: 4, low: 2 },
          total: { maxScore: 6, score: 3 },
          zeroReason: null,
        },
        text: "(a) Temperature. (b) It goes up. (c) The enzymes die. (d) Slower.",
      },
      durationMs: 600_000,
      hour: 12,
      isCorrect: false,
      itemId: item.id,
      localDate: session.localDate,
      score: 0.5,
      skillId: skill.id,
      studySessionId: session.id,
      userId: user.id,
      weekday: session.localDate.getUTCDay(),
    },
  });

  return { blockId: block.id, user };
}
