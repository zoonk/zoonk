import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import {
  mistakePracticeCompletionSchema,
  mistakePracticeFeedbackSchema,
  mistakePracticeResponseSchema,
} from "../src/lib/openapi/schemas/mistakes";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

const DAY_MS = 86_400_000;

/**
 * A goal with one lesson done: its skill is due, has three questions and a mistake of the given
 * cause saved yesterday, so "Practice mistakes" and today's practice both drill it.
 */
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
