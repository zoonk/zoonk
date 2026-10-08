import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getFocusTest } from "./get-focus-test";
import { requestFocusTestQuestions } from "./request-focus-test-questions";
import { submitFocusTest } from "./submit-focus-test";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(async () => false),
}));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("../../analytics/server", () => ({ trackServerEvent: vi.fn() }));

const RIGHT = { selectedIndex: 0 };
const WRONG = { selectedIndex: 1 };
const citation = { passage: "Conteúdo programático", sourceId: "notice" };

/** A notice with two subjects worth the same and a written test of its own. */
function noticeStructure() {
  return {
    formats: [],
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: { description: "", method: "raw" },
      sections: [
        { day: null, kind: "objective", minutes: null, name: "Objective test", questions: 60 },
        { day: null, kind: "written", minutes: 180, name: "Written test (P3)", questions: null },
      ],
      timeLimitMinutes: null,
      totalQuestions: 60,
    },
    rules: [],
    subjects: [
      { citation, name: "Law", questions: 30, shortName: "Civil law", topics: [], weight: null },
      { citation, name: "Math", questions: 30, topics: [], weight: null },
      {
        citation,
        group: "Written test (P3)",
        name: "Discursive answers",
        questions: null,
        topics: [],
        weight: null,
      },
    ],
  };
}

/**
 * A learner whose plan has four skills in each of `areas`, with one multiple-choice question per
 * skill unless `withoutItems` names the area; an exam goal with the notice above when `exam`.
 */
async function setup({
  areas = ["Law", "Math"],
  exam = false,
  withoutItems = null,
}: { areas?: string[]; exam?: boolean; withoutItems?: string | null } = {}) {
  const user = await userFixture();
  const blueprint = exam ? await examBlueprintFixture({ structure: noticeStructure() }) : null;

  const goal = await goalFixture({
    details: { placementDeclined: true },
    examBlueprintId: blueprint?.id ?? null,
    kind: exam ? "exam" : "learn",
    userId: user.id,
  });

  const skills = await Promise.all(
    areas.flatMap((area) =>
      Array.from({ length: 4 }, async (_, index) => ({
        area,
        skill: await skillFixture({ name: `${area} skill ${index + 1}` }),
      })),
    ),
  );

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: skills.map(({ area, skill }) => ({
        area,
        lessons: 2,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
  });

  await Promise.all(
    skills
      .filter(({ area }) => area !== withoutItems)
      .map(({ skill }) => itemFixture({ content: choiceItemContent(), skillId: skill.id })),
  );

  mockSession(user.id);

  return { goal, plan, skills: skills.map(({ skill }) => skill), user };
}

async function readQuestions(goalId: string) {
  const result = await getFocusTest({ goalId });
  return result.status === "ready" ? result.focusTest.questions : [];
}

describe(getFocusTest, () => {
  it("asks a few questions on each area, area by area, without the answers", async () => {
    const { goal } = await setup();
    const result = await getFocusTest({ goalId: goal.id });

    expect(result).toMatchObject({
      focusTest: { areas: ["Law", "Math"], needsItems: [], questionsPerArea: 4 },
      status: "ready",
    });

    const questions = result.status === "ready" ? result.focusTest.questions : [];

    expect(questions.map((question) => question.area)).toStrictEqual([
      ...Array.from({ length: 4 }, () => "Law"),
      ...Array.from({ length: 4 }, () => "Math"),
    ]);

    expect(JSON.stringify(result)).not.toContain("isCorrect");
  });

  it("leaves out the notice's written test and the plan's own extras", async () => {
    const { goal } = await setup({
      areas: ["Law", "Math", "Discursive answers", "Exam strategy"],
      exam: true,
    });

    await expect(getFocusTest({ goalId: goal.id })).resolves.toMatchObject({
      focusTest: { areas: ["Law", "Math"] },
      status: "ready",
    });

    // Each question names its subject as learners call it.
    const questions = await readQuestions(goal.id);

    expect(new Set(questions.map((question) => question.area))).toStrictEqual(
      new Set(["Civil law", "Math"]),
    );
  });

  it("asks the questions that exist and names the skills whose questions are still to write", async () => {
    const { goal, skills } = await setup({ withoutItems: "Math" });
    const result = await getFocusTest({ goalId: goal.id });

    expect(result).toMatchObject({
      focusTest: { needsItems: skills.slice(4).map((skill) => skill.id) },
      status: "ready",
    });

    const questions = result.status === "ready" ? result.focusTest.questions : [];
    expect(questions.map((question) => question.area)).toStrictEqual(["Law", "Law", "Law", "Law"]);
  });

  it("never asks a question the learner already answered, and has others written instead", async () => {
    const { goal, skills, user } = await setup();
    const [first, second] = await readQuestions(goal.id);

    // Placement asked the first two Law skills' questions.
    await Promise.all(
      [first, second].map((question) =>
        attemptFixture({
          itemId: question?.itemId ?? null,
          skillId: question?.skillId ?? null,
          userId: user.id,
        }),
      ),
    );

    const questions = await readQuestions(goal.id);
    const asked = questions.map((question) => question.itemId);

    expect(asked).not.toContain(first?.itemId);
    expect(asked).not.toContain(second?.itemId);
    expect(questions).toHaveLength(6);

    await expect(requestFocusTestQuestions({ goalId: goal.id })).resolves.toMatchObject({
      skillIds: skills.slice(0, 2).map((skill) => skill.id),
      status: "start",
    });
  });

  it("asks an exam's multiple choice only with the exam's number of options", async () => {
    const { goal, skills } = await setup({ exam: true });
    const fiveOptions = choiceItemContent();

    await Promise.all([
      prisma.examBlueprint.updateMany({
        data: {
          structure: {
            ...noticeStructure(),
            formats: [{ citation, description: "A to E", kind: "multipleChoice", options: 5 }],
          },
        },
        where: { goals: { some: { id: goal.id } } },
      }),
      ...skills
        .slice(0, 4)
        .map((skill) =>
          itemFixture({
            content: {
              ...fiveOptions,
              options: Array.from({ length: 5 }, (_, index) => ({
                ...fiveOptions.options[1],
                isCorrect: index === 0,
                text: `Option ${index + 1}`,
              })),
            },
            skillId: skill.id,
          }),
        ),
    ]);

    // Every skill has a two-option question; only Law's five-option ones are the exam's.
    const result = await getFocusTest({ goalId: goal.id });

    expect(result).toMatchObject({
      focusTest: { needsItems: skills.slice(4).map((skill) => skill.id) },
      status: "ready",
    });

    const questions = result.status === "ready" ? result.focusTest.questions : [];
    expect(questions.every((question) => question.options?.length === 5)).toBe(true);
  });

  it("fills a place with a question written later without moving the ones already asked", async () => {
    const { goal, skills } = await setup({ exam: true, withoutItems: "Math" });
    const before = await readQuestions(goal.id);

    // The run writes the exam's own questions for every skill while the learner answers.
    const examBlueprintId = goal.examBlueprintId ?? "";

    await Promise.all(
      skills.map((skill) =>
        itemFixture({ content: choiceItemContent(), examBlueprintId, skillId: skill.id }),
      ),
    );

    const after = await readQuestions(goal.id);

    expect(after.slice(0, 4)).toStrictEqual(before);

    expect(after.slice(4).map((question) => question.area)).toStrictEqual([
      "Math",
      "Math",
      "Math",
      "Math",
    ]);
  });

  it("isn't offered for a plan with one area, nor for someone else's goal", async () => {
    const { goal } = await setup({ areas: ["Law"] });

    await expect(getFocusTest({ goalId: goal.id })).resolves.toStrictEqual({
      status: "unavailable",
    });

    await setup();
    await expect(getFocusTest({ goalId: goal.id })).resolves.toStrictEqual({ status: "notFound" });
  });
});

describe(requestFocusTestQuestions, () => {
  it("asks for nothing when every area has its questions", async () => {
    const { goal, user } = await setup();

    await expect(requestFocusTestQuestions({ goalId: goal.id })).resolves.toStrictEqual({
      status: "ready",
    });

    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("names the skills to write questions for, in the test's format", async () => {
    const { goal, skills } = await setup({ withoutItems: "Math" });

    await expect(requestFocusTestQuestions({ goalId: goal.id })).resolves.toMatchObject({
      format: "multipleChoice",
      questionsPerSkill: 1,
      skillIds: skills.slice(4).map((skill) => skill.id),
      status: "start",
    });
  });
});

describe(submitFocusTest, () => {
  it("focuses the plan on the area the answers show needs it, and records every answer", async () => {
    const { goal, plan, user } = await setup();
    const questions = await readQuestions(goal.id);

    const result = await submitFocusTest({
      goalId: goal.id,
      input: {
        answers: questions.map((question) => ({
          answer: question.area === "Law" ? RIGHT : WRONG,
          durationMs: 8000,
          itemId: question.itemId,
        })),
      },
    });

    expect(result).toMatchObject({
      outcome: {
        areas: [
          { answers: [true, true, true, true], chosen: false, correct: 4, name: "Law", total: 4 },
          {
            answers: [false, false, false, false],
            chosen: true,
            correct: 0,
            name: "Math",
            total: 4,
          },
        ],
        focusAreas: ["Math"],
      },
      status: "ready",
    });

    const stored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(stored.settings).toMatchObject({ focusAreas: ["Math"] });

    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(8);

    // The test's 8 answers and their minute of answering count in the learner's day.
    await expect(
      prisma.dailyProgress.findFirstOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ correctAnswers: 4, incorrectAnswers: 4, timeSpentSeconds: 64 });

    await expect(
      prisma.learningEvent.findFirstOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ kind: "questions", lessonKind: "focusTest", seconds: 64 });
  });

  it("refuses a question that isn't on the test's areas", async () => {
    const { goal } = await setup();
    const outsider = await skillFixture({ name: "Elsewhere" });
    const item = await itemFixture({ content: choiceItemContent(), skillId: outsider.id });

    await expect(
      submitFocusTest({
        goalId: goal.id,
        input: { answers: [{ answer: RIGHT, durationMs: 5000, itemId: item.id }] },
      }),
    ).resolves.toStrictEqual({ status: "invalidItem" });
  });
});
