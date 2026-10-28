import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { isJsonObject } from "@zoonk/utils/json";
import { planChangeResultSchema, planResponseSchema } from "../src/lib/openapi/schemas/plans";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { readBody } from "./helpers/response";

const FOREIGN = "Língua Estrangeira";
const SPANISH = "Língua Espanhola";
const TIME_ZONE = "America/Sao_Paulo";

async function createChoiceGoal(userId: string) {
  const citation = { passage: "Língua Estrangeira (Inglês ou Espanhol)", sourceId: "notice" };
  const option = { choiceGroup: FOREIGN, citation, questions: 5, topics: [], weight: null };

  const blueprint = await examBlueprintFixture({
    language: "pt",
    structure: {
      formats: [],
      mock: null,
      rules: [],
      subjects: [
        { ...option, name: "Língua Inglesa", shortName: "Inglês" },
        { ...option, name: SPANISH, shortName: "Espanhol" },
      ],
    },
  });

  const goal = await goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId });
  await planFixture({ goalId: goal.id, phases: [] });

  return goal;
}

async function loadPicks(goalId: string): Promise<unknown> {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  return isJsonObject(plan.settings) ? (plan.settings.examChoices ?? []) : null;
}

test.describe("Exam choices API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication", async () => {
    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post(`/v1/goals/${randomUUID()}/plan/exam-choices`, {
      data: { group: FOREIGN, subject: SPANISH },
    });

    expect(response.status()).toBe(401);
    await apiContext.dispose();
  });

  test("keeps the option the learner takes, which the plan then lists as picked", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "exam-choices",
    });

    const goal = await createChoiceGoal(user.id);

    const before = await readBody({
      response: await apiContext.get(`/v1/goals/${goal.id}/plan`),
      schema: planResponseSchema,
    });

    expect(before.examChoices).toStrictEqual([
      {
        group: FOREIGN,
        options: [
          { name: "Língua Inglesa", shortName: "Inglês" },
          { name: SPANISH, shortName: "Espanhol" },
        ],
        subject: null,
      },
    ]);

    const picked = await readBody({
      response: await apiContext.post(`/v1/goals/${goal.id}/plan/exam-choices`, {
        data: { group: FOREIGN, subject: SPANISH, timeZone: TIME_ZONE },
      }),
      schema: planChangeResultSchema,
    });

    expect(picked).toMatchObject({ change: null, status: "applied" });
    await expect(loadPicks(goal.id)).resolves.toStrictEqual([{ group: FOREIGN, subject: SPANISH }]);

    const after = await readBody({
      response: await apiContext.get(`/v1/goals/${goal.id}/plan`),
      schema: planResponseSchema,
    });

    expect(after.examChoices[0]?.subject).toBe(SPANISH);
    await apiContext.dispose();
  });

  test("refuses an option the exam doesn't offer, and another learner's goal", async () => {
    const [{ apiContext, user }, other] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "exam-choices-invalid" }),
      createAuthenticatedApiContext({ baseURL, prefix: "exam-choices-other" }),
    ]);

    const goal = await createChoiceGoal(user.id);

    const unknown = await apiContext.post(`/v1/goals/${goal.id}/plan/exam-choices`, {
      data: { group: FOREIGN, subject: "Língua Francesa" },
    });

    expect(unknown.status()).toBe(422);

    await expect(unknown.json()).resolves.toMatchObject({
      error: { code: "PLAN_CHANGE_INVALID", details: { reason: "unknownOption" } },
    });

    const foreign = await other.apiContext.post(`/v1/goals/${goal.id}/plan/exam-choices`, {
      data: { group: FOREIGN, subject: SPANISH },
    });

    expect(foreign.status()).toBe(404);
    await expect(loadPicks(goal.id)).resolves.toStrictEqual([]);

    await Promise.all([apiContext.dispose(), other.apiContext.dispose()]);
  });
});
