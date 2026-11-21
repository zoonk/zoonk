import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { writingResultSchema, writingStartSchema } from "@zoonk/core/exams/essays/writing-contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { essayViewResponseSchema } from "../src/lib/openapi/schemas/essays";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

const DAILY_EXTRA_WRITES = 6;
const MINUTES = 20;
const TASK = { count: 1, description: "Argumentative essay", key: "essay", lines: 30 };
const CRITERION = { id: "argument", name: "Argument", points: null };

const SHORT_DRAFT = {
  durationMs: 600_000,
  text: "Minha redação sobre desinformação.",
  timeZone: "UTC",
};

function fillWritingAllowance({ localDate, userId }: { localDate: Date; userId: string }) {
  return prisma.writingAdmission.createMany({
    data: Array.from({ length: DAILY_EXTRA_WRITES }, () => ({
      extra: true,
      id: randomUUID(),
      itemIds: [],
      localDate,
      userId,
    })),
  });
}

async function createEssayBlock(userId: string) {
  const [blueprint, skill] = await Promise.all([
    examBlueprintFixture({
      identityKey: `enem-${randomUUID()}`,
      name: "ENEM",
      structure: {
        formats: [],
        mock: {
          adaptive: false,
          citations: [],
          order: null,
          scoring: { description: "Evaluate the written argument", method: "other" },
          sections: [
            {
              day: null,
              kind: "written",
              minutes: MINUTES,
              name: TASK.description,
              questions: null,
              tasks: [TASK],
            },
          ],
          timeLimitMinutes: MINUTES,
          totalQuestions: null,
        },
        rules: [],
        subjects: [],
      },
      visibility: "public",
    }),
    skillFixture({ name: `Redação ${randomUUID()}`, visibility: "public" }),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    language: "en",
    timezone: "UTC",
    userId,
  });

  const prompt = {
    charactersPerLine: 60,
    criteria: [CRITERION],
    keySource: "practiceKey",
    lines: TASK.lines,
    minimumWords: 10,
    points: null,
    taskKey: TASK.key,
    title: "Disinformation in Brazil",
    unit: "answer",
  };

  const essay = {
    context: "Tema: o combate à desinformação no Brasil.",
    keyPoints: ["Proposta de intervenção com os cinco elementos"],
    question: "Escreva um texto dissertativo-argumentativo sobre o tema.",
    rubric: [{ criterion: "Argument", description: "Use evidence to support an argument." }],
    sampleOutline: "Introdução, dois argumentos e a proposta.",
    writing: {
      ...prompt,
      aspects: [],
      assessedSkillIds: [skill.id],
      grading: { criteria: [], kind: "levels", language: null, rounding: null, zeroing: [] },
    },
  };

  const [item, session] = await Promise.all([
    itemFixture({
      content: essay,
      examBlueprintId: blueprint.id,
      format: "essay",
      skillId: skill.id,
    }),
    studySessionFixture({ goalId: goal.id, userId }),
  ]);

  const block = await studySessionBlockFixture({
    estimatedMinutes: MINUTES,
    kind: "produce",
    payload: {
      extra: true,
      itemIds: [],
      skillIds: [skill.id],
      title: TASK.description,
      writing: { admissionId: null, draft: null, taskKey: TASK.key, unit: "answer" },
    },
    sessionId: session.id,
    status: "pending",
  });

  return {
    blockId: block.id,
    essay,
    itemId: item.id,
    path: `/v1/essays/${block.id}`,
    prompt,
    sessionId: session.id,
  };
}

test.describe("Essays API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires a session to start writing or submit a draft", async () => {
    const anonymous = await request.newContext({ baseURL });
    const path = `/v1/essays/${randomUUID()}`;

    try {
      const responses = await Promise.all([
        anonymous.post(`${path}/starts`, { data: {} }),
        anonymous.post(`${path}/submissions`, {
          data: { ...SHORT_DRAFT, admissionId: randomUUID() },
        }),
      ]);

      expect(responses.map((response) => response.status())).toStrictEqual([401, 401]);
    } finally {
      await anonymous.dispose();
    }
  });

  test("admits an owned question and grades it after midnight without charging twice", async () => {
    const [learner, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "essay" }),
      createBearerLearner({ baseURL, prefix: "essay-other" }),
    ]);

    try {
      const { blockId, essay, itemId, path, prompt, sessionId } = await createEssayBlock(
        learner.userId,
      );

      const [unissued, otherStart] = await Promise.all([
        learner.api.get(path),
        other.api.post(`${path}/starts`, { data: {} }),
      ]);

      expect(unissued.status()).toBe(404);
      expect(otherStart.status()).toBe(404);

      const started = await readBody({
        response: await learner.api.post(`${path}/starts`, { data: {} }),
        schema: writingStartSchema,
      });

      if (started.status !== "ready") {
        throw new Error(`Expected an admitted question, got ${started.status}`);
      }

      const { admissionId } = started;

      const readEssay = () =>
        learner.api
          .get(`${path}?timeZone=UTC`)
          .then((response) => readBody({ response, schema: essayViewResponseSchema }));

      expect(await readEssay()).toStrictEqual({
        blockId,
        context: essay.context,
        draft: null,
        drafts: [],
        gradesLeft: DAILY_EXTRA_WRITES - 1,
        pacing: { minutes: MINUTES, source: "practice" },
        question: essay.question,
        rubric: "levels",
        sessionId,
        status: "active",
        writing: prompt,
      });

      const submission = { ...SHORT_DRAFT, admissionId };

      const refusals = await Promise.all([
        other.api.get(path),
        other.api.post(`${path}/submissions`, { data: submission }),
        learner.api.post(`/v1/essays/${randomUUID()}/submissions`, { data: submission }),
        learner.api.post("/v1/essays/not-a-block/submissions", { data: submission }),
        learner.api.post(`${path}/submissions`, { data: SHORT_DRAFT }),
        learner.api.post(`${path}/submissions`, { data: { ...submission, text: " " } }),
        learner.api.post(`${path}/submissions`, {
          data: { ...submission, timeZone: "Mars/Olympus" },
        }),
        learner.api.post(`${path}/submissions`, { data: { ...submission, score: 1000 } }),
      ]);

      expect(refusals.map((response) => response.status())).toStrictEqual([
        404, 404, 404, 400, 400, 400, 400, 400,
      ]);

      const today = toUTCMidnight(new Date());
      const yesterday = new Date(today.getTime() - MS_PER_DAY);

      await Promise.all([
        prisma.writingAdmission.update({
          data: { localDate: yesterday },
          where: { id: admissionId },
        }),
        fillWritingAllowance({ localDate: today, userId: learner.userId }),
      ]);

      const submit = () =>
        learner.api
          .post(`${path}/submissions`, { data: submission })
          .then((response) => readBody({ response, schema: writingResultSchema }));

      const grade = await submit();

      expect(grade).toMatchObject({
        criteria: [{ id: CRITERION.id, level: "missing" }],
        estimatedLines: 1,
        kind: "levels",
        nextStep: { criterionId: CRITERION.id },
      });

      await expect(submit()).resolves.toStrictEqual(grade);

      const attempts = await prisma.attempt.findMany({ where: { itemId, userId: learner.userId } });
      expect(attempts).toHaveLength(1);

      expect(attempts[0]?.answer).toMatchObject({
        conditions: { admissionId },
        grade,
        text: SHORT_DRAFT.text,
      });

      expect(await readEssay()).toMatchObject({
        draft: null,
        drafts: [{ attemptId: attempts[0]?.id, grade, text: SHORT_DRAFT.text }],
        gradesLeft: 0,
      });

      await expect(
        prisma.writingAdmission.findUnique({ where: { id: admissionId } }),
      ).resolves.toMatchObject({ extra: true, itemIds: [itemId], localDate: yesterday });

      await expect(
        prisma.writingAdmission.count({ where: { userId: learner.userId } }),
      ).resolves.toBe(DAILY_EXTRA_WRITES + 1);
    } finally {
      await Promise.all([learner.api.dispose(), other.api.dispose()]);
    }
  });

  test("refuses extra writing before issuing a question when today's allowance is used", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "essay-limit" });

    try {
      const { blockId, path } = await createEssayBlock(userId);
      const today = toUTCMidnight(new Date());

      await fillWritingAllowance({ localDate: today, userId });

      const refusal = await readBody({
        response: await api.post(`${path}/starts`, { data: {} }),
        schema: writingStartSchema,
        status: 429,
      });

      expect(refusal).toStrictEqual({
        returnsOn: new Date(today.getTime() + MS_PER_DAY).toISOString().slice(0, 10),
        status: "limitReached",
        task: {
          description: TASK.description,
          lines: TASK.lines,
          minutes: MINUTES,
          points: null,
          taskKey: TASK.key,
          unit: "answer",
        },
      });

      const unissued = await api.get(path);
      expect(unissued.status()).toBe(404);

      await expect(
        prisma.studySessionBlock.findUnique({ where: { id: blockId } }),
      ).resolves.toMatchObject({
        payload: { itemIds: [], writing: { admissionId: null } },
        startedAt: null,
        status: "pending",
      });

      await expect(prisma.writingAdmission.count({ where: { userId } })).resolves.toBe(
        DAILY_EXTRA_WRITES,
      );
    } finally {
      await api.dispose();
    }
  });
});
