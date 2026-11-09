import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { profileQuestionsResponseSchema } from "../src/lib/openapi/schemas/profile-questions";
import { createAuthenticatedApiContext } from "./helpers/auth";

test("profile endpoints require a session", async () => {
  const api = await request.newContext({ baseURL: process.env.E2E_BASE_URL });

  const responses = await Promise.all([
    api.get("/v1/me/profile-questions"),
    api.post("/v1/me/profile-questions/answers", {
      data: { answer: { declined: true }, question: "work" },
    }),
  ]);

  expect(responses.map((response) => response.status())).toStrictEqual([401, 401]);
  await api.dispose();
});

test("profile answers persist privately, enforce consent and memory settings, and skip onboarding without plan work", async () => {
  const { apiContext: api, user } = await createAuthenticatedApiContext({
    baseURL: process.env.E2E_BASE_URL ?? "",
    prefix: "profile",
  });

  const saved = await api.post("/v1/me/profile-questions/answers", {
    data: { answer: { picks: ["soccer"] }, question: "play" },
    headers: { "accept-language": "pt" },
  });

  expect(saved.status()).toBe(200);

  const response = await api.get("/v1/me/profile-questions", {
    headers: { "accept-language": "pt" },
  });

  const profile = profileQuestionsResponseSchema.parse(await response.json());

  expect(profile.questions.find((question) => question.id === "play")?.saved.picks).toStrictEqual([
    "soccer",
  ]);

  expect(profile.questions.find((question) => question.id === "play")?.options[0]?.id).toBe(
    "futsal",
  );

  const facts = await prisma.memoryFact.findMany({ where: { userId: user.id } });
  expect(facts).toMatchObject([{ sensitive: false, statement: "Joga futebol" }]);

  const invalid = await api.post("/v1/me/profile-questions/answers", {
    data: { answer: { picks: ["forged"] }, question: "watch" },
  });

  expect(invalid.status()).toBe(422);

  const consent = await api.post("/v1/me/profile-questions/answers", {
    data: { answer: { conditions: [{ condition: "adhd" }] }, question: "conditions" },
  });

  expect(consent.status()).toBe(422);
  expect(await consent.json()).toMatchObject({ error: { code: "CONSENT_REQUIRED" } });

  await learningProfileFixture({ memoryEnabled: false, userId: user.id });

  const memoryOff = await api.post("/v1/me/profile-questions/answers", {
    data: { answer: { status: "student" }, question: "work" },
  });

  expect(memoryOff.status()).toBe(409);
  expect(await memoryOff.json()).toMatchObject({ error: { code: "MEMORY_OFF" } });
  await learningProfileFixture({ memoryEnabled: true, userId: user.id });

  const goal = await goalFixture({ planRevealedAt: null, userId: user.id });

  const answered = await api.post(`/v1/goals/${goal.id}/onboarding/answers`, {
    data: { answer: { status: "student" }, question: "work" },
  });

  expect(answered.status()).toBe(200);

  const skipped = await api.post(`/v1/goals/${goal.id}/onboarding/answers`, {
    data: { answer: null, question: "tools" },
  });

  expect(skipped.status()).toBe(200);

  const skippedAll = await api.post(`/v1/goals/${goal.id}/onboarding/answers`, {
    data: { question: "skipProfile" },
  });

  expect(skippedAll.status()).toBe(200);
  const plan = await prisma.plan.findUnique({ where: { goalId: goal.id } });
  expect(plan).toBeNull();
  await api.dispose();
});
