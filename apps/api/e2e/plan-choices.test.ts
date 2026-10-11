import { type APIRequestContext } from "@playwright/test";
import { planChangePreviewSchema } from "@zoonk/core/plans/preview-contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalWithBasesFixture } from "@zoonk/testing/fixtures/plan-bases";
import { onboardingResponseSchema } from "../src/lib/openapi/schemas/onboarding";
import { planChangeResultSchema, planResponseSchema } from "../src/lib/openapi/schemas/plans";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { readBody } from "./helpers/response";

/** Today's first read builds the plan the goal's run handed over, as after onboarding. */
async function openToday({
  apiContext,
  goalId,
}: {
  apiContext: APIRequestContext;
  goalId: string;
}) {
  const today = await apiContext.get(`/v1/today?timeZone=UTC&goalId=${goalId}`);
  expect(today.status(), await today.text()).toBe(200);
}

/**
 * The learner's choices when time is short, through the API as the apps make them: how to study
 * the plan's bases (with what a choice would do before it's made) and studying everything.
 */
test.describe("Plan choices API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("shows an exam's bases with the recommendation, previews a choice without saving it, then saves choices and studies everything", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "plan-choices",
    });

    const { bases, goal } = await goalWithBasesFixture({ days: 30, kind: "exam", userId: user.id });
    const [cells, living] = bases;
    const plan = `/v1/goals/${goal.id}/plan`;

    await openToday({ apiContext, goalId: goal.id });

    const before = await readBody({
      response: await apiContext.get(plan),
      schema: planResponseSchema,
    });

    expect(before.bases).toMatchObject({
      daysLeft: 30,
      items: [
        { area: "Biology", choice: "essential", name: "Cell structure", neededFor: ["Heredity"] },
        { area: "Biology", choice: "essential", name: "Living things", neededFor: ["Ecology"] },
      ],
      knownCount: 0,
      recommended: "quick",
    });

    const [base] = before.bases?.items ?? [];
    const { deep = 0, essential = 0, quick = 0 } = base?.minutes ?? {};

    expect(quick).toBeLessThan(essential);
    expect(essential).toBeLessThan(deep);
    expect(before.schedule.fullCourse).toBe(false);

    // Studying everything would end after the exam.
    const fullCourseEnd = before.feasibility?.fullCourseEndDate ?? "";
    expect(fullCourseEnd > (before.schedule.targetDate ?? "")).toBe(true);

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

    // A preview saves nothing.
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

    // The quick lesson is a lesson of its own in the plan, written when the learner gets to it.
    const quickItems = await prisma.planItem.findMany({
      select: { lesson: { select: { contentStatus: true, identityKey: true } } },
      where: { kind: "lesson", skillId: cells?.skillId },
    });

    expect(quickItems.map((item) => item.lesson)).toStrictEqual([
      { contentStatus: "pending", identityKey: `quick:${cells?.skillId}` },
    ]);

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
    expect(after.phases.at(-1)?.kind).toBe("afterExam");

    expect(after.schedule).toMatchObject({
      fullCourse: true,
      targetDate: before.schedule.targetDate,
    });

    await apiContext.dispose();
  });

  test("studying everything after the date is an exam's; any other goal drops its deadline instead", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "plan-choices-learn",
    });

    const { goal } = await goalWithBasesFixture({ days: 20, kind: "learn", userId: user.id });
    const plan = `/v1/goals/${goal.id}/plan`;

    await openToday({ apiContext, goalId: goal.id });

    const notExam = await apiContext.post(`${plan}/changes`, {
      data: { operations: [{ fullCourse: true, kind: "setFullCourse" }] },
    });

    expect(notExam.status()).toBe(422);

    await expect(notExam.json()).resolves.toMatchObject({
      error: { code: "PLAN_CHANGE_INVALID", details: { reason: "notExam" } },
    });

    const noDeadline = await readBody({
      response: await apiContext.post(`${plan}/changes`, {
        data: { operations: [{ kind: "setTargetDate", targetDate: null }] },
      }),
      schema: planChangeResultSchema,
    });

    expect(noDeadline).toMatchObject({ status: "applied" });

    const after = await readBody({
      response: await apiContext.get(plan),
      schema: planResponseSchema,
    });

    expect(after.schedule.targetDate).toBeNull();
    expect(after.feasibility?.fits).toBe(true);

    await apiContext.dispose();
  });

  test("onboarding's time answer can study everything after the exam, and the new plan starts on the recommended bases", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "plan-choices-onboarding",
    });

    const { goal } = await goalWithBasesFixture({ days: 30, kind: "exam", userId: user.id });

    await readBody({
      response: await apiContext.post(`/v1/goals/${goal.id}/onboarding/answers`, {
        data: { dailyMinutes: 15, fullCourse: true, question: "schedule", timeZone: "UTC" },
      }),
      schema: onboardingResponseSchema,
    });

    const plan = await readBody({
      response: await apiContext.get(`/v1/goals/${goal.id}/plan`),
      schema: planResponseSchema,
    });

    expect(plan.schedule.fullCourse).toBe(true);

    expect(plan.bases?.items.map((item) => item.choice)).toStrictEqual(["quick", "quick"]);

    await apiContext.dispose();
  });
});
