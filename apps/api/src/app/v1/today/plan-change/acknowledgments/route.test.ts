import { acknowledgedTodayPlanChangeSchema } from "@zoonk/core/plans/today-change-contract";
import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../../../../../../../packages/core/src/_test-utils/mock-session";
import { mandatoryPhasePlanFixture } from "../../../../../../../../packages/core/src/plans/_test-utils/mandatory-phase-plan";
import { POST as acknowledgeRoute } from "./route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

function acknowledge(input: unknown) {
  return acknowledgeRoute(
    new NextRequest("http://localhost/v1/today/plan-change/acknowledgments", {
      body: JSON.stringify(input),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  );
}

describe("POST /v1/today/plan-change/acknowledgments", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("returns the real acknowledged ID and revision without creating a session", async () => {
    const fixture = await mandatoryPhasePlanFixture({ atRisk: true });
    mockSession(fixture.user.id);
    vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));

    const notice = await planChangeFixture({
      kind: "missedDays",
      planId: fixture.plan.id,
      status: "applied",
    });

    const input = { changeId: notice.id, kind: "stored" };

    const response = await acknowledge(input);
    expect(response.status).toBe(200);
    const result = acknowledgedTodayPlanChangeSchema.parse(await response.json());
    const saved = await prisma.planChange.findUniqueOrThrow({ where: { id: result.changeId } });
    expect(saved).toMatchObject({ kind: "missedDays", planId: fixture.plan.id, status: "applied" });

    await expect(prisma.studySession.count({ where: { userId: fixture.user.id } })).resolves.toBe(
      0,
    );

    const replay = await countDatabaseStatements(() => acknowledge(input));
    expect(replay.writes).toBe(0);
    expect(replay.result.status).toBe(200);
    await expect(replay.result.json()).resolves.toStrictEqual(result);
  });

  it("rejects a null stored request ID and an unauthenticated POST without writes", async () => {
    mockSession(null);

    const invalid = await countDatabaseStatements(() =>
      acknowledge({ changeId: null, kind: "stored" }),
    );

    expect(invalid.result.status).toBe(400);
    expect(invalid.writes).toBe(0);

    const unauthorized = await countDatabaseStatements(() =>
      acknowledge({ changeId: crypto.randomUUID(), kind: "stored" }),
    );

    expect(unauthorized.result.status).toBe(401);
    expect(unauthorized.writes).toBe(0);
  });

  it("never acknowledges another learner's saved notice", async () => {
    const fixture = await mandatoryPhasePlanFixture({ atRisk: true });
    const stranger = await userFixture();
    mockSession(stranger.id);
    vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));

    const notice = await planChangeFixture({
      kind: "missedDays",
      planId: fixture.plan.id,
      status: "applied",
    });

    const result = await countDatabaseStatements(() =>
      acknowledge({ changeId: notice.id, kind: "stored" }),
    );

    expect(result.result.status).toBe(404);
    expect(result.writes).toBe(0);

    await expect(
      prisma.planChange.count({ where: { planId: fixture.plan.id, status: "applied" } }),
    ).resolves.toBe(1);
  });
});
