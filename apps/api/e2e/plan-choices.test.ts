import { planBasesAdviceSchema } from "@zoonk/core/plans/bases-advice-contract";
import { planChangePreviewSchema } from "@zoonk/core/plans/preview-contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalWithBasesFixture } from "@zoonk/testing/fixtures/plan-bases";
import { planChangeResultSchema, planResponseSchema } from "../src/lib/openapi/schemas/plans";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { openStudyDay } from "./helpers/open-study-day";
import { readBody } from "./helpers/response";

test.describe("Plan choices API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("shows an exam's bases, recommends a choice when asked, previews a choice without saving it, then saves choices and studies everything", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "plan-choices",
    });

    const { bases, goal } = await goalWithBasesFixture({ days: 30, kind: "exam", userId: user.id });
    const [cells, living] = bases;
    const plan = `/v1/goals/${goal.id}/plan`;

    await openStudyDay({ api: apiContext, goalId: goal.id });

    const read = await apiContext.get(plan);
    const before = await readBody({ response: read, schema: planResponseSchema });

    expect(before.bases).toMatchObject({
      daysLeft: 30,
      items: [
        { area: "Biology", choice: "essential", name: "Cell structure", neededFor: ["Heredity"] },
        { area: "Biology", choice: "essential", name: "Living things", neededFor: ["Ecology"] },
      ],
      knownCount: 0,
    });

    const readJson = await read.json();
    expect(readJson).not.toHaveProperty("bases.recommended");

    await expect(
      readBody({
        response: await apiContext.post(`${plan}/bases-advice`),
        schema: planBasesAdviceSchema,
      }),
    ).resolves.toStrictEqual({ daysLeft: 30, ready: true, recommended: "quick" });

    const quickLessons = [cells, living].map((item) => ({
      choice: "quick" as const,
      skillId: item?.skillId ?? "",
    }));

    const preview = await readBody({
      response: await apiContext.post(`${plan}/change-previews`, {
        data: { operations: [{ choices: quickLessons, kind: "setBaseChoices" }], timeZone: "UTC" },
      }),
      schema: planChangePreviewSchema,
    });

    expect(preview).toMatchObject({ ready: true, unchanged: false });
    expect(preview.feasibility?.measure).toBe("exam");

    const previewed = await readBody({
      response: await apiContext.get(plan),
      schema: planResponseSchema,
    });

    expect(previewed.bases?.items.map((item) => item.choice)).toStrictEqual([
      "essential",
      "essential",
    ]);

    const skipped = await readBody({
      response: await apiContext.post(`${plan}/changes`, {
        data: {
          operations: [
            { choices: [{ choice: "skip", skillId: living?.skillId }], kind: "setBaseChoices" },
          ],
        },
      }),
      schema: planChangeResultSchema,
    });

    expect(skipped).toMatchObject({ status: "applied" });

    const quickLesson = await readBody({
      response: await apiContext.post(`${plan}/changes`, {
        data: {
          operations: [
            { choices: [{ choice: "quick", skillId: cells?.skillId }], kind: "setBaseChoices" },
          ],
        },
      }),
      schema: planChangeResultSchema,
    });

    expect(quickLesson).toMatchObject({ status: "applied" });

    const everything = await readBody({
      response: await apiContext.post(`${plan}/changes`, {
        data: { operations: [{ fullCourse: true, kind: "setFullCourse" }] },
      }),
      schema: planChangeResultSchema,
    });

    expect(everything).toMatchObject({ status: "applied" });

    const after = await readBody({
      response: await apiContext.get(plan),
      schema: planResponseSchema,
    });

    expect(after.bases?.items.map((item) => item.choice)).toStrictEqual(["quick", "skip"]);

    expect(after.schedule).toMatchObject({
      fullCourse: true,
      targetDate: before.schedule.targetDate,
    });

    await apiContext.dispose();
  });
});
