import { randomUUID } from "node:crypto";
import { type APIRequestContext, type APIResponse, request } from "@playwright/test";
import {
  lessonQuestionResourceSchema,
  lessonQuestionThreadResponseSchema,
} from "@zoonk/core/lesson-questions/contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import {
  goalFixture,
  planChangeFixture,
  planFixture,
  planItemFixture,
} from "@zoonk/testing/fixtures/goals";
import {
  catalogCourseFixture,
  privateCourseFixture,
} from "@zoonk/testing/fixtures/library-courses";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { todayResponseSchema } from "../src/lib/openapi/schemas/today";
import { createBearerLearner } from "./helpers/bearer";
import { createExamGoal } from "./helpers/exams";

const SUGGESTION = "Explain this more simply";

function ask({
  api,
  context,
  path,
  question = "What will I be able to do after this?",
  suggested,
}: {
  api: APIRequestContext;
  context: object;
  path: string;
  question?: string;
  suggested?: true;
}) {
  return api.post(path, { data: { context, question, requestId: randomUUID(), suggested } });
}

async function readCreated(response: APIResponse) {
  expect(response.status(), await response.text()).toBe(201);
  return lessonQuestionResourceSchema.parse(await response.json());
}

/** A learn goal whose plan teaches one skill, so the plan is built and can be asked about. */
async function createPlannedGoal(userId: string) {
  const goal = await goalFixture({ timezone: "UTC", userId });

  const [plan, skill] = await Promise.all([
    planFixture({ goalId: goal.id }),
    skillFixture({ name: "Scientific notation" }),
  ]);

  await planItemFixture({
    planId: plan.id,
    skillId: skill.id,
    titleSnapshot: "Scientific notation",
  });

  return goal;
}

/** Today's mock of a Plus learner's exam goal. */
async function createMockBlock({ api, userId }: { api: APIRequestContext; userId: string }) {
  const { goal } = await createExamGoal(userId);

  const today = await api.get(`/v1/today?goalId=${goal.id}&timeZone=UTC`);
  const { session } = todayResponseSchema.parse(await today.json());
  const block = session.blocks.find((candidate) => candidate.checkpoint?.mock);

  if (!block) {
    throw new Error("Expected today's mock");
  }

  return block.id;
}

test.describe("Tutor threads beyond lessons", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("requires a session for every kind of thread", async () => {
    const anonymous = await request.newContext({ baseURL });
    const id = randomUUID();

    const paths = [
      `/v1/chapters/${id}/questions`,
      `/v1/goals/${id}/plan/questions`,
      `/v1/mocks/${id}/questions`,
    ];

    const responses = await Promise.all(
      paths.flatMap((path) => [
        anonymous.get(path),
        ask({ api: anonymous, context: { kind: "chapter" }, path }),
      ]),
    );

    expect(responses.map((response) => response.status())).toStrictEqual(
      paths.flatMap(() => [401, 401]),
    );

    await anonymous.dispose();
  });

  test("keeps a private thread about a chapter", async () => {
    const [{ api }, other, { chapters }] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "tutor-chapter" }),
      createBearerLearner({ baseURL, prefix: "tutor-chapter-other" }),
      catalogCourseFixture({ lessonCounts: [2] }),
    ]);

    const chapterPath = `/v1/chapters/${chapters[0]?.id}/questions`;
    const theirs = await privateCourseFixture({ ownerId: other.userId });

    const [chapterQuestion, mismatched, hidden] = await Promise.all([
      readCreated(await ask({ api, context: { kind: "chapter" }, path: chapterPath })),
      ask({ api, context: { kind: "lesson" }, path: chapterPath }),
      ask({
        api,
        context: { kind: "chapter" },
        path: `/v1/chapters/${theirs.chapters[0]?.id}/questions`,
      }),
    ]);

    expect(chapterQuestion).toMatchObject({ context: { kind: "chapter" }, status: "pending" });
    expect([mismatched.status(), hidden.status()]).toStrictEqual([422, 404]);

    const [thread, question, otherThread] = await Promise.all([
      api.get(chapterPath),
      api.get(`/v1/questions/${chapterQuestion.id}`),
      other.api.get(chapterPath),
    ]);

    expect(lessonQuestionThreadResponseSchema.parse(await thread.json())).toMatchObject({
      lessonId: null,
      questions: [{ id: chapterQuestion.id }],
    });

    expect(question.status()).toBe(200);
    await expect(otherThread.json()).resolves.toBeNull();

    await Promise.all([api.dispose(), other.api.dispose()]);
  });

  test("asks about the learner's own plan only", async () => {
    const [{ api, userId }, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "tutor-plan" }),
      createBearerLearner({ baseURL, prefix: "tutor-plan-other" }),
    ]);

    const goal = await createPlannedGoal(userId);
    const path = `/v1/goals/${goal.id}/plan/questions`;

    const [created, hidden] = await Promise.all([
      ask({ api, context: { kind: "plan" }, path, question: "Why am I studying this today?" }),
      ask({ api: other.api, context: { kind: "plan" }, path }),
    ]);

    const question = await readCreated(created);

    expect(question).toMatchObject({ context: { kind: "plan" } });
    expect(hidden.status()).toBe(404);

    const [thread, hiddenThread] = await Promise.all([api.get(path), other.api.get(path)]);

    expect(lessonQuestionThreadResponseSchema.parse(await thread.json())).toMatchObject({
      questions: [{ id: question.id, planChange: null }],
    });

    expect(hiddenThread.status()).toBe(404);

    // A plan change the buddy proposed in its answer comes with the question, waiting for an OK.
    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    const change = await planChangeFixture({
      kind: "edited",
      payload: { operations: [{ kind: "setDailyMinutes", minutes: 20 }], source: "planEdit" },
      planId: plan.id,
      reason: "Twenty minutes a day.",
      status: "proposed",
    });

    await prisma.lessonQuestion.update({
      data: { planChangeId: change.id },
      where: { id: question.id },
    });

    const [withChange, single] = await Promise.all([
      api.get(path),
      api.get(`/v1/questions/${question.id}`),
    ]);

    // The app says a change read from the learner's words from its operations, not the model's.
    const proposal = {
      id: change.id,
      operations: [{ kind: "setDailyMinutes", minutes: 20 }],
      reason: null,
      status: "proposed",
    };

    expect(lessonQuestionThreadResponseSchema.parse(await withChange.json())).toMatchObject({
      questions: [{ id: question.id, planChange: proposal }],
    });

    expect(lessonQuestionResourceSchema.parse(await single.json())).toMatchObject({
      planChange: proposal,
    });

    await Promise.all([api.dispose(), other.api.dispose()]);
  });

  test("asks about a mock only once it's finished", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "tutor-mock" });
    const blockId = await createMockBlock({ api, userId });
    const mockPath = `/v1/mocks/${blockId}`;
    const path = `${mockPath}/questions`;

    const started = await api.post(`${mockPath}/starts`, { data: { timeZone: "UTC" } });
    expect(started.status()).toBe(204);

    // No help with an exam that's still running.
    const [running, runningThread] = await Promise.all([
      ask({ api, context: { kind: "mock" }, path }),
      api.get(path),
    ]);

    expect([running.status(), runningThread.status()]).toStrictEqual([404, 404]);

    const submitted = await api.post(`${mockPath}/sections/0/submissions`, {
      data: { timeZone: "UTC" },
    });

    expect(submitted.status(), await submitted.text()).toBe(200);

    const question = await readCreated(
      await ask({
        api,
        context: { kind: "mock" },
        path,
        question: "What should I practice first?",
      }),
    );

    expect(question.context).toStrictEqual({ kind: "mock" });

    const thread = await api.get(path);

    expect(lessonQuestionThreadResponseSchema.parse(await thread.json())).toMatchObject({
      questions: [{ id: question.id }],
    });

    await api.dispose();
  });

  test("streams the shared answer to a common question on a screen without a new generation", async () => {
    const [{ api, userId }, { lesson, steps }] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "tutor-shared" }),
      playableLessonFixture({ steps: ["explanation", "check"] }),
    ]);

    const step = steps[0];

    if (!step) {
      throw new Error("Expected the lesson's first screen");
    }

    const shared = await prisma.tutorSharedAnswer.create({
      data: {
        answer: "A simpler take on this screen.",
        model: "openai/gpt-6-luna",
        normalizedQuestion: "explain-this-more-simply",
        promptVersion: "shared-prompt-version",
        question: SUGGESTION,
        runId: "shared-run",
        stepId: step.id,
      },
    });

    const question = await readCreated(
      await ask({
        api,
        context: { kind: "step", stepId: step.id, stepNumber: step.position + 1 },
        path: `/v1/lessons/${lesson.id}/questions`,
        question: SUGGESTION,
        suggested: true,
      }),
    );

    const answer = await api.post(`/v1/questions/${question.id}/answers`);

    expect(answer.status()).toBe(200);
    expect(answer.headers()["x-vercel-ai-ui-message-stream"]).toBe("v1");

    const body = await answer.text();

    expect(body).toContain('"delta":"A simpler take on this screen."');
    expect(body).toContain("data: [DONE]");

    const [stored, usage] = await Promise.all([
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: question.id } }),
      prisma.usageRecord.count({ where: { kind: "tutorMessage", userId } }),
    ]);

    expect(stored).toMatchObject({
      answer: shared.answer,
      promptVersion: shared.promptVersion,
      runId: shared.runId,
      sharedAnswerId: shared.id,
      status: "completed",
    });

    // A saved answer costs no generation, so it doesn't count against the tutor allowance.
    expect(usage).toBe(0);

    await expect(
      api.get(`/v1/questions/${question.id}`).then((response) => response.json()),
    ).resolves.toMatchObject({ answer: shared.answer, status: "completed" });

    await api.dispose();
  });
});
