import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { thirdsMath, thirdsQuestion } from "../../library/items/_test-utils/math-problems";
import { getMock } from "./get-mock";
import { listMockPrepWrites } from "./prepare-mock-questions";
import { requestMockQuestions } from "./request-mock-questions";
import { startAnytimeMock } from "./start-anytime-mock";

const CITATION = { passage: "From the notice.", sourceId: "source" };
const PAPER = "Paper 1";
const FULL = { area: null, day: null, kind: "full" } as const;

/**
 * JEE Advanced's brochure: one right option, one or more, an integer typed in, with no counts
 * for each, in one paper of nine questions.
 */
const STRUCTURE = {
  formats: [
    { citation: CITATION, description: "One correct", kind: "multipleChoice", options: null },
    {
      citation: CITATION,
      description: "One or more correct",
      kind: "multipleChoice",
      options: null,
      select: "all",
    },
    {
      citation: CITATION,
      description: "A non-negative integer",
      entry: { kind: "integer", places: null },
      kind: "numeric",
      options: null,
    },
  ],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" },
    sections: [{ day: null, kind: "objective", minutes: 18, name: PAPER, questions: 9 }],
    timeLimitMinutes: 18,
    totalQuestions: 9,
  },
  rules: [],
  subjects: [],
};

const NUMBER = {
  context: null,
  entry: { kind: "integer", places: null },
  math: thirdsMath,
  otherSolutions: [],
  question: thirdsQuestion,
};

type Bank = { numbers: number; onePicks: number; severalPicks: number };

/** A JEE learner on Plus with two skills, each with that many questions of each format. */
async function formatsSetup(bank: Bank) {
  const [user, blueprint, skills] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure: STRUCTURE }),
    Promise.all(
      ["Kinematics", "Probability"].map((name) =>
        skillFixture({ name: `${name} ${crypto.randomUUID()}` }),
      ),
    ),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: "UTC",
    userId: user.id,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: skills.map((skill) => ({
        area: PAPER,
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
  });

  const contents = [
    ...Array.from({ length: bank.onePicks }, () => ({
      content: choiceItemContent(),
      format: "multipleChoice" as const,
    })),
    ...Array.from({ length: bank.severalPicks }, () => ({
      content: { ...choiceItemContent(), select: "all" },
      format: "multipleChoice" as const,
    })),
    ...Array.from({ length: bank.numbers }, () => ({
      content: NUMBER,
      format: "numeric" as const,
    })),
  ];

  await Promise.all([
    ...skills.map((skill, position) =>
      planItemFixture({ kind: "lesson", planId: plan.id, position, skillId: skill.id }),
    ),
    ...skills.flatMap((skill) =>
      contents.map(({ content, format }) =>
        itemFixture({ content, examBlueprintId: blueprint.id, format, skillId: skill.id }),
      ),
    ),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  mockSession(user.id);

  return { goal, skills };
}

describe("a mock in the exam's own mix of formats", () => {
  it("asks each format its share of the paper, format by format", async () => {
    const { goal } = await formatsSetup({ numbers: 3, onePicks: 3, severalPicks: 3 });

    const started = await startAnytimeMock({
      goalId: goal.id,
      input: { shape: FULL, timeZone: "UTC" },
    });

    if (started.status !== "started") {
      throw new Error(`Expected a started mock, got ${started.status}`);
    }

    const result = await getMock(started.id);
    const questions = result.status === "ready" ? (result.mock.current?.questions ?? []) : [];

    expect(
      questions.map((question) =>
        question.format === "multipleChoice" ? `picks:${question.select ?? 1}` : question.format,
      ),
    ).toStrictEqual([
      ...Array.from({ length: 3 }, () => "picks:1"),
      ...Array.from({ length: 3 }, () => "picks:all"),
      ...Array.from({ length: 3 }, () => "numeric"),
    ]);
  });

  it("has the formats the bank is short of written first, numbers only for skills that take them", async () => {
    const { goal, skills } = await formatsSetup({ numbers: 0, onePicks: 9, severalPicks: 0 });
    const [kinematics, probability] = skills;

    await itemFixture({
      content: NUMBER,
      examBlueprintId: goal.examBlueprintId,
      format: "numeric",
      skillId: kinematics?.id ?? "",
    });

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { shape: FULL, timeZone: "UTC" } }),
    ).resolves.toStrictEqual({ status: "needsQuestions" });

    const request = await requestMockQuestions({ goalId: goal.id, input: { shape: FULL } });
    const writes = request.status === "start" ? request.writes : [];

    // The one-pick questions are there; three of one or more, spread over both skills, and three
    // numbers, from the skill the bank already asks numbers about (it holds one), are not.
    expect(
      writes.map(({ format, questionsPerSkill, skillIds, target }) => ({
        key: format.key,
        questionsPerSkill,
        skillIds,
        target,
      })),
    ).toStrictEqual([
      {
        key: "picks:all",
        questionsPerSkill: 2,
        skillIds: [kinematics?.id, probability?.id],
        target: 2,
      },
      { key: "numeric:integer:", questionsPerSkill: 2, skillIds: [kinematics?.id], target: 3 },
    ]);
  });

  it("prepares the exam's first learner's full mock in every format, and leaves later ones' to their mocks", async () => {
    const { goal, skills } = await formatsSetup({ numbers: 0, onePicks: 1, severalPicks: 0 });
    const [kinematics, probability] = skills;

    await itemFixture({
      content: NUMBER,
      examBlueprintId: goal.examBlueprintId,
      format: "numeric",
      skillId: kinematics?.id ?? "",
    });

    const first = await listMockPrepWrites({ goalId: goal.id });

    expect(
      first.writes.map(({ format, questionsPerSkill, skillIds, target }) => ({
        key: format.key,
        questionsPerSkill,
        skillIds,
        target,
      })),
    ).toStrictEqual([
      // Each skill holds one of the two one-pick questions its share asks, and Kinematics one of
      // its three numbers.
      {
        key: "choice",
        questionsPerSkill: 1,
        skillIds: [kinematics?.id, probability?.id],
        target: 2,
      },
      {
        key: "picks:all",
        questionsPerSkill: 2,
        skillIds: [kinematics?.id, probability?.id],
        target: 2,
      },
      { key: "numeric:integer:", questionsPerSkill: 2, skillIds: [kinematics?.id], target: 3 },
    ]);

    const laterLearner = await userFixture();

    const later = await goalFixture({
      examBlueprintId: goal.examBlueprintId,
      kind: "exam",
      timezone: "UTC",
      userId: laterLearner.id,
    });

    await expect(listMockPrepWrites({ goalId: later.id })).resolves.toStrictEqual({
      quickFormat: "multipleChoice",
      writes: [],
    });
  });
});
