import { focusTestSummarySchema } from "@zoonk/core/learner/placement/focus-test-contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  placementAnswerResponseSchema,
  placementCompletionResponseSchema,
  placementResponseSchema,
} from "../src/lib/openapi/schemas/learner";
import { createGuest } from "./helpers/bearer";
import { readBody } from "./helpers/response";

test("Focus test API saves a guest's answers, resumes, and continues without a usage claim", async () => {
  const { guestApi: api, userId } = await createGuest(process.env.E2E_BASE_URL ?? "");
  const goal = await goalFixture({ kind: "exam", planRevealedAt: null, userId });
  const skills = await Promise.all([skillFixture(), skillFixture()]);

  await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Exam" }],
      skills: skills.map((skill, index) => ({
        area: `Subject ${index + 1}`,
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
    items: skills.map((skill) => ({ skillId: skill.id })),
    placementPreparedAt: new Date(),
  });

  await Promise.all(
    skills.map((skill) => itemFixture({ content: choiceItemContent(), skillId: skill.id })),
  );

  const path = `/v1/goals/${goal.id}/placement`;

  const initial = await readBody({
    response: await api.get(path),
    schema: placementResponseSchema,
  });

  expect(initial).toMatchObject({
    focusTest: { sitting: null, subjects: [{ asked: 0 }, { asked: 0 }] },
    next: null,
  });

  const opened = await readBody({
    response: await api.post(`${path}/sittings`, { data: {} }),
    schema: placementResponseSchema,
  });

  expect(opened.focusTest?.sitting).toMatchObject({ answered: 0, questions: 8 });

  const input = { answer: { dontKnow: true }, durationMs: 10_000, itemId: opened.next?.itemId };

  const responses = await Promise.all([
    api.post(`${path}/answers`, { data: input }),
    api.post(`${path}/answers`, { data: input }),
  ]);

  const saved = await Promise.all(
    responses.map((response) => readBody({ response, schema: placementAnswerResponseSchema })),
  );

  expect(saved.map((answer) => answer.placement.focusTest?.sitting?.answered)).toStrictEqual([
    1, 1,
  ]);

  await expect(prisma.attempt.count({ where: { userId } })).resolves.toBe(1);

  const resumed = await readBody({
    response: await api.get(path),
    schema: placementResponseSchema,
  });

  expect(resumed.focusTest?.sitting).toMatchObject({ answered: 1, minutes: 7, questions: 8 });

  const completion = await readBody({
    response: await api.post(`${path}/completion`, { data: {} }),
    schema: placementCompletionResponseSchema,
  });

  expect(completion.focusTest).toMatchObject({ checkpoint: { lessonsSkipped: 0 }, sitting: null });
  expect(completion).not.toHaveProperty("celebration");

  const continued = await readBody({
    response: await api.post(`${path}/sittings`, { data: {} }),
    schema: placementResponseSchema,
  });

  expect(continued.focusTest?.sitting).toMatchObject({ answered: 0 });

  const paused = await readBody({
    response: await api.patch(path, { data: { sessionQuestions: "paused" } }),
    schema: focusTestSummarySchema,
  });

  expect(paused.sessionQuestions).toBe("paused");

  const [empty, basics] = await Promise.all([
    api.patch(path, { data: {} }),
    api.post(`${path}/completion`, { data: { fromScratch: true } }),
  ]);

  expect(empty.status()).toBe(400);
  expect(basics.status()).toBe(422);
  await expect(prisma.usageRecord.count({ where: { userId } })).resolves.toBe(0);
  await api.dispose();
});
