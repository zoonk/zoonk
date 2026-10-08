import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { type StudyBlockStatus, prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { essayViewResponseSchema } from "../src/lib/openapi/schemas/essays";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

const DAILY_ESSAY_GRADES = 6;

const ESSAY = {
  context: "Tema: o combate à desinformação no Brasil.",
  keyPoints: ["Proposta de intervenção com os cinco elementos"],
  question: "Escreva um texto dissertativo-argumentativo sobre o tema.",
  rubric: [
    { criterion: "Norma culta", description: "O português escrito formal" },
    { criterion: "Proposta", description: "Uma proposta de intervenção detalhada" },
  ],
  sampleOutline: "Introdução, dois argumentos e a proposta.",
};

/** A draft as grading stores it: essays are graded by a model, which tests don't call. */
const GRADED_DRAFT = {
  grade: {
    criteria: [
      {
        comment: "A proposta não diz por qual meio vai funcionar.",
        example: null,
        id: "c5",
        maxScore: 200,
        name: "C5",
        quote: null,
        score: 120,
      },
    ],
    enemInterventionElements: {
      action: true,
      agent: true,
      detail: false,
      effect: true,
      means: false,
    },
    nextStep: { criterionId: "c5", text: "Diga por qual meio a proposta vai funcionar." },
    range: { high: 740, low: 660 },
    total: { maxScore: 1000, score: 700 },
    zeroReason: null,
  },
  text: "Meu primeiro rascunho da redação.",
};

const DRAFT = { durationMs: 600_000, text: "Minha redação sobre desinformação.", timeZone: "UTC" };

/** An ENEM learner's writing block in today's session, in the given state. */
async function createEssayBlock({
  localDate,
  status,
  userId,
}: {
  /** The session's day; today when left out. */
  localDate?: Date;
  status: StudyBlockStatus;
  userId: string;
}) {
  const [blueprint, skill] = await Promise.all([
    examBlueprintFixture({ identityKey: `enem-${randomUUID()}`, name: "ENEM" }),
    skillFixture({ name: `Redação ${randomUUID()}` }),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: "UTC",
    userId,
  });

  const [item, session] = await Promise.all([
    itemFixture({
      content: ESSAY,
      examBlueprintId: blueprint.id,
      format: "essay",
      skillId: skill.id,
    }),
    studySessionFixture({ goalId: goal.id, userId, ...(localDate && { localDate }) }),
  ]);

  const block = await studySessionBlockFixture({
    kind: "produce",
    payload: { itemIds: [item.id], skillIds: [skill.id], title: "Redação" },
    sessionId: session.id,
    startedAt: status === "active" ? new Date() : null,
    status,
  });

  return { blockId: block.id, item, sessionId: session.id };
}

test.describe("Essays API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires a session to send a draft", async () => {
    const anonymous = await request.newContext({ baseURL });

    const response = await anonymous.post(`/v1/essays/${randomUUID()}/submissions`, {
      data: DRAFT,
    });

    expect(response.status()).toBe(401);
    await anonymous.dispose();
  });

  test("shows the writing block to its learner only and grades nothing for another day's block", async () => {
    const [learner, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "essay" }),
      createBearerLearner({ baseURL, prefix: "essay-other" }),
    ]);

    // Sending a draft starts today's writing block; a block from another day's session waits.
    const yesterday = new Date(Date.now() - MS_PER_DAY);
    yesterday.setUTCHours(0, 0, 0, 0);

    const { blockId, sessionId } = await createEssayBlock({
      localDate: yesterday,
      status: "pending",
      userId: learner.userId,
    });

    const path = `/v1/essays/${blockId}`;

    const essay = await readBody({
      response: await learner.api.get(`${path}?timeZone=UTC`),
      schema: essayViewResponseSchema,
    });

    expect(essay).toStrictEqual({
      blockId,
      context: ESSAY.context,
      drafts: [],
      gradesLeft: DAILY_ESSAY_GRADES,
      question: ESSAY.question,
      rubric: "enem",
      sessionId,
      status: "pending",
    });

    const notStarted = await learner.api.post(`${path}/submissions`, { data: DRAFT });

    expect(notStarted.status()).toBe(409);
    await expect(notStarted.json()).resolves.toMatchObject({ error: { code: "BLOCK_NOT_ACTIVE" } });

    const refusals = await Promise.all([
      other.api.get(path),
      other.api.post(`${path}/submissions`, { data: DRAFT }),
      learner.api.post(`/v1/essays/${randomUUID()}/submissions`, { data: DRAFT }),
      learner.api.post("/v1/essays/not-a-block/submissions", { data: DRAFT }),
      learner.api.post(`${path}/submissions`, { data: { ...DRAFT, text: " " } }),
      learner.api.post(`${path}/submissions`, { data: { ...DRAFT, timeZone: "Mars/Olympus" } }),
      learner.api.post(`${path}/submissions`, { data: { ...DRAFT, score: 1000 } }),
    ]);

    expect(refusals.map((response) => response.status())).toStrictEqual([
      404, 404, 404, 400, 400, 400, 400,
    ]);

    const attempts = await prisma.attempt.count({ where: { userId: learner.userId } });
    expect(attempts).toBe(0);

    await Promise.all([learner.api.dispose(), other.api.dispose()]);
  });

  test("shows the graded drafts and refuses a draft once today's grades are used up", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "essay-limit" });
    const { blockId, item, sessionId } = await createEssayBlock({ status: "active", userId });

    await Promise.all(
      Array.from({ length: DAILY_ESSAY_GRADES }, () =>
        attemptFixture({
          answer: GRADED_DRAFT,
          itemId: item.id,
          skillId: item.skillId,
          studySessionId: sessionId,
          userId,
        }),
      ),
    );

    const essay = await readBody({
      response: await api.get(`/v1/essays/${blockId}?timeZone=UTC`),
      schema: essayViewResponseSchema,
    });

    expect(essay).toMatchObject({ gradesLeft: 0, status: "active" });
    expect(essay.drafts).toHaveLength(DAILY_ESSAY_GRADES);
    expect(essay.drafts[0]).toMatchObject(GRADED_DRAFT);

    const refused = await api.post(`/v1/essays/${blockId}/submissions`, { data: DRAFT });

    expect(refused.status()).toBe(429);
    await expect(refused.json()).resolves.toMatchObject({ error: { code: "ESSAY_LIMIT_REACHED" } });

    await api.dispose();
  });
});
