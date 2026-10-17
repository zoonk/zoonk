import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import {
  startedStudyBlockResponseSchema,
  studyAnswerFeedbackResponseSchema,
  studyBlockDetailResponseSchema,
} from "../src/lib/openapi/schemas/study-sessions";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

const SAVED_REASON = "That's what you save. You pay what's left after it.";

/** A discount problem stored as data: each block asks it with its own price and discount. */
const DISCOUNT_PROBLEM = {
  context: null,
  math: {
    answer: 102,
    commonMistakes: [
      {
        expression: "price * rate / 100",
        misconception: "Answered with the discount instead of the price paid",
        reason: SAVED_REASON,
      },
    ],
    solution: "price * (1 - rate / 100)",
    steps: [
      { expression: null, text: "You pay what's left: 100% − {rate}%." },
      { expression: "price * (1 - rate / 100)", text: "{price} × (1 − {rate}/100) = {result}" },
    ],
    tolerance: { kind: "absolute", value: 0.01 },
    unit: "R$",
    variables: [
      { max: 400, min: 40, name: "price", step: 10, unit: "R$", value: 120 },
      { max: 60, min: 5, name: "rate", step: 5, unit: "%", value: 15 },
    ],
  },
  question: "An R$ {price} shirt is {rate}% off. How much do you pay, in reais?",
};

function readNumbers(question: string) {
  const [price = 0, rate = 0] = (question.match(/\d+/gu) ?? []).map(Number);
  return { paid: price * (1 - rate / 100), saved: (price * rate) / 100 };
}

test.describe("Math problems over the study sessions API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("asks with the block's numbers and grades a typed number", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "math-question" });

    const [skill, goal] = await Promise.all([
      skillFixture({ name: "Discounts" }),
      goalFixture({ timezone: "UTC", userId }),
    ]);

    const [item, session] = await Promise.all([
      itemFixture({ content: DISCOUNT_PROBLEM, format: "numeric", skillId: skill.id }),
      studySessionFixture({ goalId: goal.id, userId }),
    ]);

    const block = await studySessionBlockFixture({
      kind: "practice",
      payload: { itemIds: [item.id], skillIds: [skill.id] },
      position: 0,
      sessionId: session.id,
    });

    const blockPath = `/v1/study-sessions/${session.id}/blocks/${block.id}`;

    await readBody({
      response: await api.post(`${blockPath}/starts`, { data: {} }),
      schema: startedStudyBlockResponseSchema,
    });

    const detail = await readBody({
      response: await api.get(blockPath),
      schema: studyBlockDetailResponseSchema,
    });

    const [question] = detail.questions;

    expect(question).toMatchObject({
      format: "numeric",
      itemId: item.id,
      options: null,
      unit: { position: "prefix", symbol: "R$" },
    });

    // The same block always shows the same numbers, so the answer is graded against them.
    const again = await readBody({
      response: await api.get(blockPath),
      schema: studyBlockDetailResponseSchema,
    });

    expect(again.questions[0]?.question).toBe(question?.question);

    const invalid = await api.post(`${blockPath}/answers`, {
      data: { answer: { number: "twelve" }, durationMs: 9000, itemId: item.id },
    });

    expect(invalid.status()).toBe(400);

    const { paid, saved } = readNumbers(question?.question ?? "");

    const feedback = await readBody({
      response: await api.post(`${blockPath}/answers`, {
        data: { answer: { number: saved }, durationMs: 9000, itemId: item.id },
      }),
      schema: studyAnswerFeedbackResponseSchema,
    });

    expect(feedback).toMatchObject({
      correctAnswer: { number: paid },
      explanation: SAVED_REASON,
      isCorrect: false,
      savedToNotebook: true,
    });

    expect(feedback.workedSteps).toHaveLength(2);
  });
});
