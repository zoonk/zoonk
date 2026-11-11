import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { readMistakeSnapshot } from "@zoonk/core/mistakes/snapshot";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import {
  attemptFixture,
  learnerSkillFixture,
  mistakeFixture,
} from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import {
  gradeMathAnswer,
  parseMathItem,
} from "../../../packages/core/src/learner/_utils/math-items";
import {
  discountMath,
  discountQuestion,
} from "../../../packages/core/src/library/items/_test-utils/math-problems";
import { withRecordedNumbers } from "../../../packages/core/src/library/items/item-math";
import {
  mistakePracticeCompletionSchema,
  mistakePracticeFeedbackSchema,
  mistakePracticeResponseSchema,
} from "../src/lib/openapi/schemas/mistakes";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

const DAY_MS = 86_400_000;

async function createMistakeGoal({
  cause,
  userId,
}: {
  cause: "gap" | "time" | "trap";
  userId: string;
}) {
  const [goal, skills, lessons] = await Promise.all([
    goalFixture({ dailyMinutes: 30, timezone: "UTC", userId }),
    Promise.all([skillFixture({ name: "Discounts" }), skillFixture({ name: "Ratios" })]),
    Promise.all([
      libraryLessonFixture({
        summary: { ideas: [{ text: "A discount comes off the price." }] },
        title: "Discounts",
      }),
      libraryLessonFixture({ title: "Ratios" }),
    ]),
  ]);

  const [items] = await Promise.all([
    Promise.all(
      Array.from({ length: 3 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: skills[0]?.id ?? "" }),
      ),
    ),
    ...lessons.map((lesson, index) =>
      lessonSkillFixture({ lessonId: lesson.id, skillId: skills[index]?.id ?? "" }),
    ),
    planFixture({
      goalId: goal.id,
      items: lessons.map((lesson, position) => ({
        lessonId: lesson.id,
        skillId: skills[position]?.id ?? null,
        status: position === 0 ? ("done" as const) : ("todo" as const),
        titleSnapshot: lesson.title,
      })),
    }),
  ]);

  const [mistake] = await Promise.all([
    mistakeFixture({
      cause,
      createdAt: new Date(Date.now() - DAY_MS),
      itemId: items[0]?.id,
      skillId: skills[0]?.id,
      userId,
    }),
    learnerSkillFixture({
      difficulty: 5,
      due: new Date(Date.now() - DAY_MS),
      lastReviewedAt: new Date(Date.now() - 4 * DAY_MS),
      reps: 2,
      skillId: skills[0]?.id ?? "",
      stability: 3,
      state: "learning",
      userId,
    }),
  ]);

  return { goal, lesson: lessons[0], mistake };
}

test.describe("Mistake practice API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication to finish a run", async () => {
    const api = await request.newContext({ baseURL });

    const response = await api.post("/v1/me/mistake-practice/completions", {
      data: { answerIds: [randomUUID()] },
    });

    expect(response.status()).toBe(401);
    await api.dispose();
  });

  test("replays an original lesson question and fixes only that notebook entry", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "exact-lesson-mistake" });
    const { goal, lesson } = await createMistakeGoal({ cause: "gap", userId });
    const skill = await prisma.lessonSkill.findFirstOrThrow({ where: { lessonId: lesson!.id } });

    const content = {
      basis: null,
      context: "The saved passage",
      options: [
        { id: "right", isCorrect: true, reason: "Original reason", text: "Original right" },
        { id: "wrong", isCorrect: false, reason: "Try again", text: "Original wrong" },
      ],
      question: "Which original answer?",
    };

    const step = await libraryStepFixture({
      content,
      kind: "check",
      lessonId: lesson!.id,
      skillId: skill.skillId,
    });

    const otherStep = await libraryStepFixture({
      content,
      kind: "check",
      lessonId: lesson!.id,
      skillId: skill.skillId,
    });

    const mistake = await mistakeFixture({
      createdAt: new Date(Date.now() - DAY_MS),
      skillId: skill.skillId,
      stepId: step.id,
      userId,
    });

    const other = await mistakeFixture({
      createdAt: new Date(Date.now() - DAY_MS),
      skillId: skill.skillId,
      stepId: otherStep.id,
      userId,
    });

    const practice = await readBody({
      response: await api.get(`/v1/me/mistake-practice?goalId=${goal.id}&includeAllFormats=true`),
      schema: mistakePracticeResponseSchema,
    });

    expect(practice.practice.find((entry) => entry.mistakeId === mistake.id)).toMatchObject({
      lesson: {
        step: {
          content: { context: "The saved passage", question: "Which original answer?" },
          id: step.id,
        },
      },
      questions: [],
    });

    const payload = {
      answer: { kind: "check", optionId: "right" },
      attemptId: randomUUID(),
      durationMs: 2000,
      stepId: step.id,
      timeZone: "UTC",
    };

    const wrongSource = await api.post(`/v1/me/mistakes/${mistake.id}/answers`, {
      data: { ...payload, stepId: otherStep.id },
    });

    expect(wrongSource.status()).toBe(422);

    const feedback = await readBody({
      response: await api.post(`/v1/me/mistakes/${mistake.id}/answers`, { data: payload }),
      schema: mistakePracticeFeedbackSchema,
    });

    expect(feedback).toMatchObject({
      fixed: true,
      fixedMistakeIds: [mistake.id],
      lessonResult: { checked: true, isCorrect: true },
    });

    await expect(prisma.mistake.findUnique({ where: { id: other.id } })).resolves.toMatchObject({
      status: "open",
    });

    const retry = await readBody({
      response: await api.post(`/v1/me/mistakes/${mistake.id}/answers`, { data: payload }),
      schema: mistakePracticeFeedbackSchema,
    });

    expect(retry).toStrictEqual(feedback);
    await api.dispose();
  });

  test("replays the original numeric serving through the public contract", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "exact-numeric-mistake" });
    const { goal, mistake } = await createMistakeGoal({ cause: "gap", userId });

    const row = await itemFixture({
      content: { context: null, math: discountMath, question: discountQuestion },
      format: "numeric",
      skillId: mistake.skillId ?? "",
    });

    const item = parseMathItem(row);

    if (!item) {
      throw new Error("The numeric original must be playable");
    }

    const version = withRecordedNumbers({
      ...item.content,
      language: item.language,
      values: { discount: 20, price: 100 },
    });

    if (!version) {
      throw new Error("The original numbers must be valid");
    }

    const graded = gradeMathAnswer({ answer: 999, item, version });

    const attempt = await attemptFixture({
      answer: graded.recorded,
      answeredAt: new Date(Date.now() - DAY_MS),
      itemId: item.id,
      skillId: item.skillId,
      userId,
    });

    const original = await mistakeFixture({
      attemptId: attempt.id,
      createdAt: new Date(Date.now() - DAY_MS),
      itemId: item.id,
      skillId: item.skillId,
      snapshot: readMistakeSnapshot(graded.snapshot),
      userId,
    });

    const practice = await readBody({
      response: await api.get(`/v1/me/mistake-practice?goalId=${goal.id}&includeAllFormats=true`),
      schema: mistakePracticeResponseSchema,
    });

    expect(practice.practice.find((entry) => entry.mistakeId === original.id)).toMatchObject({
      questions: [
        {
          format: "numeric",
          question: "A shirt costs 100 and is 20% off. How much do you pay?",
          unit: { symbol: "R$" },
        },
      ],
    });

    const payload = {
      answer: { number: 80 },
      attemptId: randomUUID(),
      durationMs: 2000,
      itemId: item.id,
      timeZone: "UTC",
    };

    const feedback = await readBody({
      response: await api.post(`/v1/me/mistakes/${original.id}/answers`, { data: payload }),
      schema: mistakePracticeFeedbackSchema,
    });

    expect(feedback).toMatchObject({
      correctAnswer: { number: 80 },
      fixed: true,
      fixedMistakeIds: [original.id],
      workedSteps: [expect.any(String), expect.any(String)],
    });

    await api.dispose();
  });

  test("counts a run toward today once, and only the learner's own answers", async () => {
    const [{ api, userId }, stranger] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "mistake-practice" }),
      createBearerLearner({ baseURL, prefix: "mistake-practice-stranger" }),
    ]);

    const { goal, mistake } = await createMistakeGoal({ cause: "gap", userId });

    await studySessionFixture({
      goalId: goal.id,
      missions: {
        picks: [{ anchor: {}, kind: "fixMistake", opens: { kind: "mistakesPractice" }, total: 1 }],
        version: 1,
      },
      userId,
    });

    const practice = await readBody({
      response: await api.get(`/v1/me/mistake-practice?goalId=${goal.id}&timeZone=UTC`),
      schema: mistakePracticeResponseSchema,
    });

    const [entry] = practice.practice;

    const feedback = await readBody({
      response: await api.post(`/v1/me/mistakes/${mistake.id}/answers`, {
        data: {
          answer: { selectedIndex: 0 },
          durationMs: 12_000,
          itemId: entry?.questions[0]?.itemId,
          timeZone: "UTC",
        },
      }),
      schema: mistakePracticeFeedbackSchema,
    });

    const finish = {
      answerIds: [feedback.answerId],
      ended: true,
      goalId: goal.id,
      timeZone: "UTC",
    };

    const counted = await readBody({
      response: await api.post("/v1/me/mistake-practice/completions", { data: finish }),
      schema: mistakePracticeCompletionSchema,
    });

    expect(counted).toMatchObject({
      brainPower: 2,
      correct: 1,
      missionMoment: {
        completed: ["fixMistake"],
        fullMeal: { bonus: 50, paid: true },
        missions: [{ kind: "fixMistake", status: "done" }],
      },
      total: 1,
    });

    const again = await readBody({
      response: await api.post("/v1/me/mistake-practice/completions", { data: finish }),
      schema: mistakePracticeCompletionSchema,
    });

    expect(again).toStrictEqual(counted);

    await expect(
      prisma.learningEvent.findMany({ where: { lessonKind: "mistakePractice", userId } }),
    ).resolves.toMatchObject([{ goalId: goal.id, kind: "questions" }]);

    const stolen = await stranger.api.post("/v1/me/mistake-practice/completions", {
      data: { answerIds: [feedback.answerId], timeZone: "UTC" },
    });

    expect(stolen.status()).toBe(422);

    await Promise.all([api.dispose(), stranger.api.dispose()]);
  });
});
