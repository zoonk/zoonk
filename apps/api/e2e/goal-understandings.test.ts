import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import {
  onboardingDraftViewSchema,
  onboardingResumeSchema,
} from "@zoonk/core/view-models/onboarding/view-schemas";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

test.describe("Goal understandings API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires a session", async () => {
    const anonymous = await request.newContext({ baseURL });
    const path = `/v1/goal-understandings/${randomUUID()}`;

    const responses = await Promise.all([
      anonymous.post("/v1/goal-understandings", { data: { goal: "physics", language: "en" } }),
      anonymous.get(path),
      anonymous.patch(path, { data: { field: "title", goal: 0, value: "Physics" } }),
      anonymous.post(`${path}/generations`),
      anonymous.get("/v1/me/onboarding-resume"),
    ]);

    expect(responses.map((response) => response.status())).toEqual([401, 401, 401, 401, 401]);
    await anonymous.dispose();
  });

  test("understands words read today at once, keeps fixes and is where the learner continues", async () => {
    const [{ api, userId }, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "understanding" }),
      createBearerLearner({ baseURL, prefix: "understanding-other" }),
    ]);

    const goal = `learn to weld for work ${randomUUID()}`;

    await goalUnderstandingFixture({
      goal,
      result: {
        followUps: [],
        goals: [
          { countryDependent: false, kind: "learn", subject: "Welding", title: "Learn to weld" },
        ],
        route: "goals",
      },
      userId,
    });

    const response = await api.post("/v1/goal-understandings", {
      data: { goal, language: "en", timeZone: "America/New_York" },
    });

    const draft = await readBody({ response, schema: onboardingDraftViewSchema, status: 201 });

    expect(response.headers().location).toBe(`/v1/goal-understandings/${draft.id}`);

    expect(draft).toMatchObject({
      generationId: null,
      goalId: null,
      prompt: goal,
      status: "understood",
    });

    const path = `/v1/goal-understandings/${draft.id}`;

    await expect(
      readBody({ response: await api.get(path), schema: onboardingDraftViewSchema }),
    ).resolves.toStrictEqual(draft);

    await expect(
      readBody({
        response: await api.post(`${path}/generations`),
        schema: onboardingDraftViewSchema,
      }),
    ).resolves.toMatchObject({ status: "understood" });

    const fixed = await readBody({
      response: await api.patch(path, { data: { field: "title", goal: 0, value: "Weld pipes" } }),
      schema: onboardingDraftViewSchema,
    });

    expect(fixed.understanding).toMatchObject({ goals: [{ draft: { title: "Weld pipes" } }] });

    const [pastDate, badEdit, hidden] = await Promise.all([
      api.patch(path, { data: { field: "targetDate", goal: 0, value: "2001-01-01" } }),
      api.patch(path, { data: { field: "title", goal: 0 } }),
      other.api.get(path),
    ]);

    expect([pastDate.status(), badEdit.status(), hidden.status()]).toEqual([422, 400, 404]);

    await expect(pastDate.json()).resolves.toMatchObject({
      error: { code: "TARGET_DATE_OUT_OF_RANGE", details: [{ bound: "earliest" }] },
    });

    await expect(
      readBody({
        response: await api.get("/v1/me/onboarding-resume"),
        schema: onboardingResumeSchema,
      }),
    ).resolves.toStrictEqual({ resume: { draftId: draft.id, kind: "draft", prompt: goal } });

    await expect(
      readBody({
        response: await other.api.get("/v1/me/onboarding-resume"),
        schema: onboardingResumeSchema,
      }),
    ).resolves.toStrictEqual({ resume: null });

    const theirs = await other.api.post("/v1/goal-understandings", {
      data: { goal, language: "en", timeZone: "America/New_York" },
    });

    await expect(
      readBody({ response: theirs, schema: onboardingDraftViewSchema, status: 202 }),
    ).resolves.toMatchObject({ status: "understanding" });

    await Promise.all([api.dispose(), other.api.dispose()]);
  });

  test("reads new words in a run the draft follows, and a second start follows the same run", async () => {
    const { api } = await createBearerLearner({ baseURL, prefix: "understanding-run" });

    const response = await api.post("/v1/goal-understandings", {
      data: { goal: `build a birdhouse ${randomUUID()}`, language: "en" },
    });

    const draft = await readBody({ response, schema: onboardingDraftViewSchema, status: 202 });

    expect(response.headers().location).toBe(`/v1/goal-understandings/${draft.id}`);
    expect(draft).toMatchObject({ status: "understanding", understanding: null });
    expect(draft.generationId).toEqual(expect.any(String));

    const stored = await readBody({
      response: await api.get(`/v1/goal-understandings/${draft.id}`),
      schema: onboardingDraftViewSchema,
    });

    expect(stored.generationId).toBe(draft.generationId);

    const run = await api.get(`/v1/generations/${encodeURIComponent(draft.generationId ?? "")}`);
    expect(run.status()).toBe(200);

    await api.dispose();
  });

  test("keeps the learner's own material with the draft and refuses what isn't theirs before charging", async () => {
    const [{ api, userId }, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "understanding-material" }),
      createBearerLearner({ baseURL, prefix: "understanding-material-other" }),
    ]);

    const [notes, theirs] = await Promise.all([
      sourceFixture({ extractedText: "Mitosis has four phases.", kind: "upload", title: "" }),
      sourceFixture({ extractedText: "Their notes", kind: "upload", title: "Their notes" }),
    ]);

    await Promise.all([
      learnerSourceFixture({ sourceId: notes.id, userId }),
      learnerSourceFixture({ sourceId: theirs.id, userId: other.userId }),
    ]);

    const goal = `test on Friday ${randomUUID()}`;

    const refused = await api.post("/v1/goal-understandings", {
      data: { goal, language: "en", materialIntent: "exam", sourceIds: [theirs.id, notes.id] },
    });

    expect(refused.status()).toBe(422);

    await expect(refused.json()).resolves.toMatchObject({
      error: { code: "MATERIAL_UNAVAILABLE", details: { sourceIds: [theirs.id] } },
    });

    await expect(prisma.usageRecord.count({ where: { userId } })).resolves.toBe(0);

    const response = await api.post("/v1/goal-understandings", {
      data: { goal, language: "en", materialIntent: "exam", sourceIds: [notes.id] },
    });

    const draft = await readBody({ response, schema: onboardingDraftViewSchema, status: 202 });

    expect(draft).toMatchObject({
      materialIntent: "exam",
      materialMissing: false,
      sources: [{ id: notes.id, title: "" }],
      status: "understanding",
    });

    await expect(
      readBody({
        response: await api.get(`/v1/goal-understandings/${draft.id}`),
        schema: onboardingDraftViewSchema,
      }),
    ).resolves.toMatchObject({ materialIntent: "exam", sources: [{ id: notes.id }] });

    const intentAlone = await api.post("/v1/goal-understandings", {
      data: { goal, language: "en", materialIntent: "exam" },
    });

    expect(intentAlone.status()).toBe(400);
    await Promise.all([api.dispose(), other.api.dispose()]);
  });

  test("starts a draft's run again after it failed", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "understanding-retry" });

    const failed = await onboardingDraftFixture({
      prompt: `learn pottery ${randomUUID()}`,
      runId: `wrun_${randomUUID()}`,
      status: "failed",
      userId,
    });

    const started = await readBody({
      response: await api.post(`/v1/goal-understandings/${failed.id}/generations`),
      schema: onboardingDraftViewSchema,
      status: 202,
    });

    expect(started.status).toBe("understanding");
    expect(started.generationId).not.toBe(failed.runId);

    await expect(
      prisma.onboardingDraft.findUniqueOrThrow({ where: { id: failed.id } }),
    ).resolves.toMatchObject({ runId: started.generationId });

    await api.dispose();
  });
});
