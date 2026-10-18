import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { mockSession } from "../../../../../../../../packages/core/src/_test-utils/mock-session";
import { POST as startGeneration } from "./route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

function startRequest(goalId: string) {
  return startGeneration(
    new NextRequest(`http://localhost/v1/goals/${goalId}/generations`, { method: "POST" }),
    { params: Promise.resolve({ goalId }) },
  );
}

describe("POST /v1/goals/{goalId}/generations", () => {
  it("does not replace a newer retry's run with a delayed HTTP receipt", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ generationRunId: "wrun_old", userId: user.id });
    mockSession(user.id);

    // While this request is starting A, another request's workflow acquires the token and saves B.
    vi.mocked(start).mockImplementationOnce(async () => {
      await prisma.goal.update({ data: { generationRunId: "wrun_newer" }, where: { id: goal.id } });
      return { runId: "wrun_delayed" } as Awaited<ReturnType<typeof start>>;
    });

    const response = await startRequest(goal.id);

    expect(response.status).toBe(202);
    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(saved.generationRunId).toBe("wrun_newer");
  });

  it.each([true, false])(
    "preserves a workflow failure recorded before its start receipt (same run: %s)",
    async (sameRun) => {
      const user = await userFixture();
      const goal = await goalFixture({ generationRunId: "wrun_owner", userId: user.id });
      const failedAt = new Date("2026-10-15T18:00:00Z");
      const plan = await planFixture({ buildFailedAt: failedAt, goalId: goal.id });
      mockSession(user.id);

      vi.mocked(start).mockResolvedValue({
        runId: sameRun ? "wrun_owner" : "wrun_joiner",
      } as Awaited<ReturnType<typeof start>>);

      const response = await startRequest(goal.id);

      expect(response.status).toBe(202);
      const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
      expect(saved.buildFailedAt).toStrictEqual(failedAt);
    },
  );

  // The client follows the run from the goal's own screens right after this answers: a run that
  // saved its id only later made those screens poll for it.
  it.each([
    ["curriculum", "learn" as const],
    ["explanation", "explain" as const],
  ])("saves the started %s run on the goal before answering", async (_label, kind) => {
    const user = await userFixture();
    const goal = await goalFixture({ kind, userId: user.id });
    mockSession(user.id);

    vi.mocked(start).mockResolvedValue({ runId: `wrun_${goal.id}` } as Awaited<
      ReturnType<typeof start>
    >);

    const response = await startRequest(goal.id);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ generationId: `wrun_${goal.id}` });

    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(saved.generationRunId).toBe(`wrun_${goal.id}`);
  });
});
