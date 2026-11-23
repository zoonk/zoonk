import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { onboardingDraftViewSchema } from "@zoonk/core/view-models/onboarding/view-schemas";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { goalCreateResponseSchema } from "../src/lib/openapi/schemas/goals";
import { onboardingResponseSchema } from "../src/lib/openapi/schemas/onboarding";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { createGuest } from "./helpers/bearer";
import { readBody } from "./helpers/response";

test.describe("Onboarding API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires a session", async () => {
    const apiContext = await request.newContext({ baseURL });
    const goalId = randomUUID();

    const responses = await Promise.all([
      apiContext.post("/v1/goal-understandings", { data: { goal: "physics", language: "en" } }),
      apiContext.get(`/v1/goals/${goalId}/onboarding`),
      apiContext.post(`/v1/goals/${goalId}/onboarding/answers`, {
        data: { purpose: "deep", question: "purpose" },
      }),
      apiContext.get(`/v1/goals/${goalId}/explanation`),
      apiContext.post(`/v1/goals/${goalId}/plan-reveal/views`),
    ]);

    expect(responses.map((response) => response.status())).toEqual([401, 401, 401, 401, 401]);
    await apiContext.dispose();
  });

  test("understands a typed goal, creates it and walks its onboarding", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "onboarding",
    });

    const goal = `i want to understand quantum physics ${randomUUID()}`;
    const notes = await sourceFixture({ kind: "upload", title: "My physics notes" });
    await learnerSourceFixture({ sourceId: notes.id, userId: user.id });

    await goalUnderstandingFixture({
      goal,
      result: {
        followUps: [],
        goals: [
          {
            countryDependent: false,
            kind: "learn",
            subject: "Quantum physics",
            title: "Understand quantum physics",
          },
        ],
        route: "goals",
        studyTime: "20:00",
      },
      userId: user.id,
    });

    const draft = await readBody({
      response: await apiContext.post("/v1/goal-understandings", {
        data: { goal, language: "en", timeZone: "America/New_York" },
      }),
      schema: onboardingDraftViewSchema,
      status: 201,
    });

    const { understanding } = draft;

    expect(understanding?.status).toBe("goals");

    if (understanding?.status !== "goals") {
      return;
    }

    const created = await readBody({
      response: await apiContext.post("/v1/goals", {
        data: {
          dailyMinutes: understanding.schedule.dailyMinutes,
          goals: understanding.goals.map((item) => item.draft),
          sourceIds: [notes.id],
          studyTime: understanding.schedule.studyTime ?? undefined,
          timeZone: "America/New_York",
        },
      }),
      schema: goalCreateResponseSchema,
      status: 201,
    });

    const goalId = created.goals[0]?.id ?? "";

    await expect(
      readBody({
        response: await apiContext.get(`/v1/goal-understandings/${draft.id}`),
        schema: onboardingDraftViewSchema,
      }),
    ).resolves.toMatchObject({ goalId, status: "understood" });

    const onboarding = await readBody({
      response: await apiContext.get(`/v1/goals/${goalId}/onboarding`),
      schema: onboardingResponseSchema,
    });

    expect(onboarding.steps[0]).toBe("purpose");
    expect(onboarding.steps.at(-1)).toBe("plan");

    await expect(
      prisma.goalSource.findMany({ select: { goalId: true }, where: { sourceId: notes.id } }),
    ).resolves.toStrictEqual([{ goalId }]);

    const answered = await readBody({
      response: await apiContext.post(`/v1/goals/${goalId}/onboarding/answers`, {
        data: { purpose: "overview", question: "purpose" },
      }),
      schema: onboardingResponseSchema,
    });

    expect(answered.steps).not.toContain("purpose");
    expect(answered.goal.details).toMatchObject({ purpose: "overview" });

    const invalid = await apiContext.post(`/v1/goals/${goalId}/onboarding/answers`, {
      data: { purpose: "everything", question: "purpose" },
    });

    expect(invalid.status()).toBe(400);
    await apiContext.dispose();
  });

  test("a card sent again, after a lost response or from two windows at once, returns the goal it started", async () => {
    const { guestApi, userId } = await createGuest(baseURL);
    const goal = `i want to learn juggling ${randomUUID()}`;

    await goalUnderstandingFixture({
      goal,
      result: {
        followUps: [],
        goals: [{ countryDependent: false, kind: "learn", subject: "Juggling", title: "Juggle" }],
        route: "goals",
      },
      userId,
    });

    const draft = await readBody({
      response: await guestApi.post("/v1/goal-understandings", {
        data: { goal, language: "en", timeZone: "UTC" },
      }),
      schema: onboardingDraftViewSchema,
      status: 201,
    });

    if (draft.understanding?.status !== "goals") {
      throw new Error("The card has no goals");
    }

    const card = {
      dailyMinutes: draft.understanding.schedule.dailyMinutes,
      goals: draft.understanding.goals.map((item) => item.draft),
      timeZone: "UTC",
    };

    const confirm = async () =>
      readBody({
        response: await guestApi.post("/v1/goals", { data: card }),
        schema: goalCreateResponseSchema,
        status: 201,
      });

    const first = await confirm();
    const goalId = first.goals[0]?.id;
    const replays = [await confirm(), ...(await Promise.all([confirm(), confirm()]))];

    expect(goalId).toBeDefined();
    expect(first.generations.map((item) => item.goalId)).toStrictEqual([goalId]);

    replays.forEach((replay) => {
      expect(replay.goals.map((item) => item.id)).toStrictEqual([goalId]);
      expect(replay.generations).toStrictEqual(first.generations);
    });

    await expect(prisma.goal.count({ where: { userId } })).resolves.toBe(1);
    await guestApi.dispose();
  });

  test("ends onboarding when the learner presses the plan reveal's action, for their goal only", async () => {
    const [{ apiContext, user }, other] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "plan-reveal" }),
      createAuthenticatedApiContext({ baseURL, prefix: "plan-reveal-other" }),
    ]);

    const goal = await goalFixture({ planRevealedAt: null, userId: user.id });
    const onboarding = `/v1/goals/${goal.id}/onboarding`;
    const views = `/v1/goals/${goal.id}/plan-reveal/views`;

    await expect(
      readBody({ response: await apiContext.get(onboarding), schema: onboardingResponseSchema }),
    ).resolves.toMatchObject({ planRevealed: false });

    const theirs = await other.apiContext.post(views);
    const first = await apiContext.post(views);
    const again = await apiContext.post(views);

    expect([theirs.status(), first.status(), again.status()]).toStrictEqual([404, 204, 204]);

    await expect(
      readBody({ response: await apiContext.get(onboarding), schema: onboardingResponseSchema }),
    ).resolves.toMatchObject({ planRevealed: true });

    await Promise.all([apiContext.dispose(), other.apiContext.dispose()]);
  });
});
