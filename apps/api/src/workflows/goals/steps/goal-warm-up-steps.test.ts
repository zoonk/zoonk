import { trackServerEvent } from "@zoonk/core/analytics/server";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { after } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { claimWarmUpStep } from "./goal-warm-up-steps";

describe(claimWarmUpStep, () => {
  it("counts following a deck still being written as cold, and only ready content as warm", async () => {
    const user = await userFixture();

    const goals = await Promise.all(
      Array.from({ length: 3 }, () => goalFixture({ userId: user.id })),
    );

    const scope = {
      generalGoal: crypto.randomUUID(),
      language: "en",
      ownerId: null,
      targetLanguage: null,
    };

    const pending: Promise<unknown>[] = [];

    vi.mocked(after).mockImplementation((work) => {
      pending.push(typeof work === "function" ? Promise.resolve(work()) : work);
    });

    const first = await claimWarmUpStep({ goalId: goals[0]!.id, scope, workflowRunId: "writer" });

    const following = await claimWarmUpStep({
      goalId: goals[1]!.id,
      scope,
      workflowRunId: "follower",
    });

    expect(first.status).toBe("claimed");
    expect(following.status).toBe("following");

    if (first.status !== "claimed") {
      throw new Error("Expected the test to own its deck");
    }

    await prisma.warmUp.update({ data: { status: "ready" }, where: { id: first.id } });
    await claimWarmUpStep({ goalId: goals[2]!.id, scope, workflowRunId: "reuse" });
    await Promise.all(pending);

    const claims = vi
      .mocked(trackServerEvent)
      .mock.calls.filter(([event]) => event.name === "Onboarding Progressed")
      .map(([event]) => event.properties);

    expect(claims).toHaveLength(3);

    expect(claims).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ cache: "cold", goal_id: goals[0]!.id }),
        expect.objectContaining({ cache: "cold", goal_id: goals[1]!.id }),
        expect.objectContaining({ cache: "warm", goal_id: goals[2]!.id }),
      ]),
    );
  });
});
