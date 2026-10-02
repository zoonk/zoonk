import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { formatMathAnswer } from "@zoonk/utils/math-answer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { discountMath, discountQuestion } from "../library/items/_test-utils/math-problems";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { answerStudyQuestion } from "./answer-study-question";
import { finishStudyBlock } from "./finish-study-block";
import { getStudyBlock } from "./get-study-block";
import { getTodayStudySession } from "./get-today-study-session";
import { startStudyBlock } from "./start-study-block";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// The classifier is a paid model call; its behavior is covered by its eval.
vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({ classifyMistakeCause: vi.fn() }));

const MATH_CONTENT = { context: null, math: discountMath, question: discountQuestion };

function mathItemFixture(skillId: string) {
  return itemFixture({ content: MATH_CONTENT, format: "numeric", skillId });
}

/** Numbers as questions and answers show them, without floating-point noise. */
function shown(value: number): string {
  return String(Number(value.toFixed(4)));
}

/** The price and the discount a question shows, what the learner pays and what they save. */
function readNumbers(question: string) {
  const [price = 0, discount = 0] = (question.match(/\d+(?:\.\d+)?/gu) ?? []).map(Number);
  return { discount, paid: price * (1 - discount / 100), price, saved: (price * discount) / 100 };
}

async function loadQuestions({ blockId, sessionId }: { blockId: string; sessionId: string }) {
  const detail = await getStudyBlock({ blockId, sessionId });

  if (detail.status !== "ready") {
    throw new Error("Expected the block's questions");
  }

  return detail.detail.questions;
}

/** A learner whose only due skill is reviewed with one math problem. */
async function mathReviewDay() {
  const user = await userFixture();

  const { goal, planItems, skills } = await sessionGoalFixture({
    itemsPerSkill: 0,
    lessons: 1,
    userId: user.id,
  });

  const skillId = skills[0]?.id ?? "";

  const [item] = await Promise.all([
    mathItemFixture(skillId),
    prisma.planItem.update({ data: { status: "done" }, where: { id: planItems[0]?.id } }),
    dueSkillFixture({ skillId, userId: user.id }),
  ]);

  mockSession(user.id);
  const today = await getTodayStudySession({ goalId: goal.id });
  const session = today.status === "ready" ? today.session : null;
  const review = session?.blocks.find((block) => block.kind === "review");

  if (!session || !review) {
    throw new Error("Expected today's review");
  }

  return { goal, item, review, session, skillId, user };
}

/** A block of another day's session that reviews the skill with the same problem. */
function laterReviewBlock({
  itemId,
  position,
  sessionId,
  skillId,
}: {
  itemId: string;
  position: number;
  sessionId: string;
  skillId: string;
}) {
  return studySessionBlockFixture({
    kind: "review",
    payload: {
      capsules: [
        {
          format: "rapidFire",
          itemIds: [itemId],
          key: `skill:${skillId}`,
          lessonId: null,
          skillIds: [skillId],
          title: "Discounts",
        },
      ],
      skillIds: [skillId],
    },
    position,
    sessionId,
  });
}

describe("math problems in sessions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reviews with the numbers shown, keeps them with the answer and draws new ones next time", async () => {
    const { goal, item, review, session, skillId, user } = await mathReviewDay();

    expect(review.capsules).toMatchObject([{ format: "rapidFire", questions: 1 }]);

    await startStudyBlock({ blockId: review.id, input: {}, sessionId: session.id });
    const [question] = await loadQuestions({ blockId: review.id, sessionId: session.id });

    expect(question).toMatchObject({
      format: "numeric",
      itemId: item.id,
      options: null,
      timeMachine: null,
      unit: { position: "prefix", symbol: "R$" },
    });

    const asked = question?.question ?? "";
    const { discount, paid, price } = readNumbers(asked);

    const answered = await answerStudyQuestion({
      blockId: review.id,
      input: { answer: { number: paid }, durationMs: 9000, itemId: item.id },
      sessionId: session.id,
    });

    expect(answered).toMatchObject({
      feedback: {
        correctAnswer: { number: paid },
        explanation: null,
        isCorrect: true,
        savedToNotebook: false,
        workedSteps: [
          expect.stringContaining(String(price)),
          `Subtract it: you pay ${shown(paid)}.`,
        ],
      },
      status: "ready",
    });

    const attempt = await prisma.attempt.findFirstOrThrow({
      where: { itemId: item.id, userId: user.id },
    });

    expect(attempt.answer).toStrictEqual({ number: paid, values: { discount, price } });

    const tomorrow = await studySessionFixture({
      goalId: goal.id,
      localDate: new Date(SESSION_TODAY.getTime() + DAY_MS),
      userId: user.id,
    });

    const blocks = await Promise.all(
      [0, 1, 2].map((position) =>
        laterReviewBlock({ itemId: item.id, position, sessionId: tomorrow.id, skillId }),
      ),
    );

    const later = await Promise.all(
      blocks.map(async (block) => {
        const [laterQuestion] = await loadQuestions({ blockId: block.id, sessionId: tomorrow.id });
        return laterQuestion;
      }),
    );

    const fresh = later.find((laterQuestion) => laterQuestion?.question !== asked);

    // An answer given with other numbers says nothing about today's, so only its result shows.
    expect(fresh?.timeMachine).toMatchObject({ answer: null, isCorrect: true });
  });

  it("keeps a wrong number that matches a common mistake in the notebook with the numbers shown", async () => {
    const user = await userFixture();

    const { goal, skills } = await sessionGoalFixture({
      itemsPerSkill: 0,
      lessons: 1,
      userId: user.id,
    });

    const skillId = skills[0]?.id ?? "";

    const [item, session] = await Promise.all([
      mathItemFixture(skillId),
      studySessionFixture({ goalId: goal.id, userId: user.id }),
    ]);

    const block = await studySessionBlockFixture({
      kind: "practice",
      payload: { itemIds: [item.id], skillIds: [skillId] },
      sessionId: session.id,
      status: "active",
    });

    mockSession(user.id);
    const [question] = await loadQuestions({ blockId: block.id, sessionId: session.id });
    const { paid, saved } = readNumbers(question?.question ?? "");

    const answered = await answerStudyQuestion({
      blockId: block.id,
      input: { answer: { number: saved }, durationMs: 12_000, itemId: item.id },
      sessionId: session.id,
    });

    expect(answered).toMatchObject({
      feedback: {
        correctAnswer: { number: paid },
        explanation: "That's how much you save, not what you pay.",
        isCorrect: false,
        savedToNotebook: true,
      },
      status: "ready",
    });

    const mistake = await prisma.mistake.findFirstOrThrow({
      where: { itemId: item.id, userId: user.id },
    });

    expect(mistake.snapshot).toMatchObject({
      answer: formatMathAnswer({ language: "en", unit: "R$", value: saved }),
      correctAnswer: formatMathAnswer({ language: "en", unit: "R$", value: paid }),
      format: "numeric",
      misconception: "Computes the discount instead of the price paid",
      question: question?.question,
    });
  });

  it("drills a math mistake with the problem itself", async () => {
    const user = await userFixture();

    const { goal, planItems, skills } = await sessionGoalFixture({
      itemsPerSkill: 0,
      lessons: 2,
      userId: user.id,
    });

    const skillId = skills[0]?.id ?? "";
    const item = await mathItemFixture(skillId);

    await Promise.all([
      prisma.planItem.update({ data: { status: "done" }, where: { id: planItems[0]?.id } }),
      mistakeFixture({ createdAt: daysAgo(1), itemId: item.id, skillId, userId: user.id }),
    ]);

    mockSession(user.id);
    const today = await getTodayStudySession({ goalId: goal.id });
    const session = today.status === "ready" ? today.session : null;
    const drill = session?.blocks.find((block) => block.kind === "practice");

    const questions = await loadQuestions({
      blockId: drill?.id ?? "",
      sessionId: session?.id ?? "",
    });

    expect(questions).toMatchObject([{ format: "numeric", itemId: item.id }]);
    expect(questions[0]?.mistakeId).toBeTruthy();
  });

  it("asks math problems in a boss and shows their worked steps once the duel ends", async () => {
    const user = await userFixture();
    const fixture = await sessionGoalFixture({ itemsPerSkill: 0, lessons: 3, userId: user.id });
    const [first, second, third] = fixture.planItems;

    await Promise.all([
      prisma.planItem.update({ data: { phase: 1, position: 5 }, where: { id: third?.id } }),
      prisma.planItem.updateMany({
        data: { status: "done" },
        where: { id: { in: [first?.id ?? "", second?.id ?? ""] } },
      }),
      ...fixture.skills
        .slice(0, 2)
        .flatMap((skill) => [0, 1, 2].map(() => mathItemFixture(skill.id))),
    ]);

    // The boss takes the third lesson's old place, so it's added once that lesson moved.
    await checkpointItemFixture({ kind: "boss", planId: fixture.plan.id, position: 2 });

    mockSession(user.id);
    const today = await getTodayStudySession({ goalId: fixture.goal.id });
    const session = today.status === "ready" ? today.session : null;
    const boss = session?.blocks.find((block) => block.kind === "checkpoint");
    const [blockId, sessionId] = [boss?.id ?? "", session?.id ?? ""];

    await startStudyBlock({ blockId, input: {}, sessionId });
    const questions = await loadQuestions({ blockId, sessionId });

    expect(questions.length).toBeGreaterThanOrEqual(5);
    expect(questions.every((question) => question.format === "numeric")).toBe(true);

    const answers = await questions.reduce<Promise<unknown[]>>(async (previous, question) => {
      const results = await previous;

      const result = await answerStudyQuestion({
        blockId,
        input: {
          answer: { number: readNumbers(question.question).paid },
          durationMs: 8000,
          itemId: question.itemId,
        },
        sessionId,
      });

      return [...results, result];
    }, Promise.resolve([]));

    // A duel without hints: no right answer or steps until it ends.
    expect(answers[0]).toMatchObject({
      feedback: { correctAnswer: null, isCorrect: true, workedSteps: [] },
    });

    const finished = await finishStudyBlock({ blockId, input: {}, sessionId });
    const results = finished.status === "ready" ? finished.completion.checkpoint?.answers : [];

    expect(finished).toMatchObject({ completion: { checkpoint: { passed: true } } });
    expect(results).toHaveLength(questions.length);

    expect(results?.find((result) => result.itemId === questions[0]?.itemId)).toMatchObject({
      correctAnswer: { number: readNumbers(questions[0]?.question ?? "").paid },
      isCorrect: true,
      workedSteps: [expect.any(String), expect.any(String)],
    });
  });
});
