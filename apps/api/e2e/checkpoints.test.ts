import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { studyBlockCompletionSchema } from "@zoonk/core/sessions/completion-contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { checkpointResponseSchema } from "../src/lib/openapi/schemas/checkpoints";
import { todayResponseSchema } from "../src/lib/openapi/schemas/today";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

const QUESTIONS_PER_SKILL = 3;
const SKILL_NAMES = ["Discounts", "Ratios"];

/** The boss asks every question of the phase's skills, since there are fewer than ten. */
const BOSS_QUESTIONS = QUESTIONS_PER_SKILL * SKILL_NAMES.length;

/** A goal whose first phase (two lessons) is done, so today's session is the phase's boss. */
async function createGoalAtBoss(userId: string) {
  const [goal, skills, lessons] = await Promise.all([
    goalFixture({ dailyMinutes: 30, timezone: "UTC", userId }),
    Promise.all(SKILL_NAMES.map((name) => skillFixture({ name }))),
    Promise.all([
      libraryLessonFixture({ title: "Discounts" }),
      libraryLessonFixture({ title: "Ratios" }),
      libraryLessonFixture({ title: "Percent change" }),
    ]),
  ]);

  const plan = await planFixture({
    goalId: goal.id,
    phases: [{ name: "Basics" }, { name: "Mix" }],
  });

  await Promise.all([
    ...skills.flatMap((skill) =>
      Array.from({ length: QUESTIONS_PER_SKILL }, () =>
        itemFixture({ content: choiceItemContent(), skillId: skill.id }),
      ),
    ),
    ...skills.map((skill, index) =>
      lessonSkillFixture({ lessonId: lessons[index]?.id ?? "", skillId: skill.id }),
    ),
    ...lessons.map((lesson, position) => {
      const firstPhase = position < SKILL_NAMES.length;

      return planItemFixture({
        kind: "lesson",
        lessonId: lesson.id,
        phase: firstPhase ? 0 : 1,
        planId: plan.id,
        position: firstPhase ? position : position + 1,
        status: firstPhase ? "done" : "todo",
        titleSnapshot: lesson.title,
      });
    }),
    planItemFixture({
      kind: "boss",
      phase: 0,
      planId: plan.id,
      position: SKILL_NAMES.length,
      titleSnapshot: "Boss",
    }),
  ]);

  return goal;
}

test.describe("Checkpoints API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication", async () => {
    const api = await request.newContext({ baseURL });
    const id = randomUUID();

    const responses = await Promise.all([
      api.get(`/v1/checkpoints/${id}`),
      api.post(`/v1/checkpoints/${id}/moves`, { data: {} }),
      api.delete(`/v1/checkpoints/${id}/moves/${randomUUID()}`),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([401, 401, 401]);
    await api.dispose();
  });

  test("describes a boss upfront, then how the duel went, only to its learner", async () => {
    const [{ api, userId }, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "checkpoint" }),
      createBearerLearner({ baseURL, prefix: "checkpoint-other" }),
    ]);

    const goal = await createGoalAtBoss(userId);

    const { session: today } = await readBody({
      response: await api.get(`/v1/today?goalId=${goal.id}&timeZone=UTC`),
      schema: todayResponseSchema,
    });

    const boss = today.blocks.find((block) => block.kind === "checkpoint");
    const path = `/v1/checkpoints/${boss?.id}`;

    const before = await readBody({
      response: await api.get(path),
      schema: checkpointResponseSchema,
    });

    expect(before).toMatchObject({
      kind: "boss",
      nextPhase: { index: 1, name: "Mix" },
      phase: { index: 0, name: "Basics" },
      result: null,
      reward: { badge: true, glasses: "star", phaseComplete: true },
      sessionId: today.id,
      status: "pending",
    });

    expect(before.questions).toHaveLength(BOSS_QUESTIONS);

    const blockPath = `/v1/study-sessions/${today.id}/blocks/${boss?.id}`;
    await api.post(`${blockPath}/starts`, { data: {} });

    await before.questions.reduce(async (previous, question) => {
      await previous;

      await api.post(`${blockPath}/answers`, {
        data: { answer: { selectedIndex: 0 }, durationMs: 4000, itemId: question.itemId },
      });
    }, Promise.resolve());

    await readBody({
      response: await api.post(`${blockPath}/completions`, { data: {} }),
      schema: studyBlockCompletionSchema,
    });

    const after = await readBody({
      response: await api.get(path),
      schema: checkpointResponseSchema,
    });

    expect(after).toMatchObject({
      result: { correct: BOSS_QUESTIONS, passed: true, total: BOSS_QUESTIONS },
      status: "completed",
    });

    const hidden = await other.api.get(path);
    expect(hidden.status()).toBe(404);

    // Only the week's challenge moves to Monday; a boss keeps its day.
    const bossMove = await api.post(`${path}/moves`, { data: {} });
    expect(bossMove.status()).toBe(404);
  });
});
