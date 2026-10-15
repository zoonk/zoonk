import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
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
