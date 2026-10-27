import { request } from "@playwright/test";
import { acknowledgedTodayPlanChangeSchema } from "@zoonk/core/plans/today-change-contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { mandatoryNoticeDayFixture } from "@zoonk/testing/fixtures/study-sessions";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { todayResponseSchema } from "../src/lib/openapi/schemas/today";
import { createBearerLearner } from "./helpers/bearer";

const PATH = "/v1/today/plan-change/acknowledgments";

test.describe("Today's mandatory notice acknowledgment API", () => {
  test.afterAll(() => prisma.$disconnect());

  test("reads falling behind without a write, then keeping the plan persists it without a session", async () => {
    const baseURL = process.env.E2E_BASE_URL ?? "";
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "mandatory-notice" });
    const localDate = getDateInTimeZone({ date: new Date(), timeZone: "UTC" });
    // A missed day that puts the goal's date at risk: the one automatic change Today asks about.
    const fixture = await mandatoryNoticeDayFixture({ atRisk: true, localDate, userId });
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } });
    const response = await api.get(`/v1/today?goalId=${fixture.goal.id}&timeZone=UTC`);
    expect(response.status(), await response.text()).toBe(200);
    const today = todayResponseSchema.parse(await response.json());

    expect(today.planChange).toMatchObject({
      behind: { coveredBefore: 1 },
      canUndo: false,
      id: null,
      kind: "missedDays",
      source: "system",
      status: "applied",
    });

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } }),
    ).resolves.toStrictEqual(before);

    await expect(prisma.planChange.count({ where: { planId: fixture.plan.id } })).resolves.toBe(0);
    await expect(prisma.studySession.count({ where: { userId } })).resolves.toBe(0);

    const input = {
      basis: today.noticeBasis,
      goalId: fixture.goal.id,
      kind: "computed",
      shownDate: localDate.toISOString().slice(0, 10),
      timeZone: "UTC",
    };

    const acknowledged = await api.post(PATH, { data: input });
    expect(acknowledged.status(), await acknowledged.text()).toBe(200);
    const receipt = acknowledgedTodayPlanChangeSchema.parse(await acknowledged.json());
    const saved = await prisma.planChange.findUniqueOrThrow({ where: { id: receipt.changeId } });
    expect(saved).toMatchObject({ planId: fixture.plan.id, status: "applied" });
    const replay = await api.post(PATH, { data: input });
    expect(replay.status()).toBe(200);
    await expect(replay.json()).resolves.toStrictEqual(receipt);

    await expect(
      prisma.planChange.count({ where: { planId: fixture.plan.id, status: "applied" } }),
    ).resolves.toBe(1);

    await expect(prisma.studySession.count({ where: { userId } })).resolves.toBe(0);
    const next = await api.get(`/v1/today?goalId=${fixture.goal.id}&timeZone=UTC`);
    expect(todayResponseSchema.parse(await next.json()).planChange).toBeNull();
    await api.dispose();
  });

  test("requires authentication and keeps request IDs required UUIDs", async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_BASE_URL ?? "" });

    const unauthorized = await api.post(PATH, {
      data: { changeId: crypto.randomUUID(), kind: "stored" },
    });

    expect(unauthorized.status()).toBe(401);
    const invalid = await api.post(PATH, { data: { changeId: null, kind: "stored" } });
    expect(invalid.status()).toBe(400);
    await api.dispose();
  });
});
