import { waitForSleep } from "@workflow/vitest";
import { classifyGoalSpecificity } from "@zoonk/ai/tasks/identity/goal-specificity";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, plannedSkills } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { getRun } from "workflow/api";
import { startOnce } from "../_shared/run-token";
import { heldInitialCurriculum } from "../_test-utils/held-initial-curriculum";
import { readStreamToEnd } from "../_test-utils/read-run-stream";
import { getGoalContentToken } from "./goal-content-workflow";
import { rebuildGoalCurriculumWorkflow } from "./rebuild-goal-curriculum-workflow";

vi.mock("@zoonk/ai/tasks/identity/goal-specificity", () => ({ classifyGoalSpecificity: vi.fn() }));

async function owedRebuild(goalId: string, userId: string) {
  const row = await prisma.followUp.create({
    data: { input: { goalId }, key: goalId, kind: "rebuildGoalCurriculum", userId },
  });

  return { id: row.id, revision: row.revision };
}

describe(rebuildGoalCurriculumWorkflow, () => {
  it("closes its composed stream when the goal was deleted", async () => {
    const goalId = crypto.randomUUID();
    const user = await userFixture();
    const followUp = await owedRebuild(goalId, user.id);

    const rebuildId = await startOnce(
      rebuildGoalCurriculumWorkflow,
      [{ followUp, goalId }],
      `rebuild-ask:${goalId}`,
    );

    const rebuild = getRun(rebuildId);

    await expect(rebuild.returnValue).resolves.toMatchObject({ goalId, status: "missing" });
    await expect(readStreamToEnd(rebuild)).resolves.toContain('"reason":"notFound"');
  });

  it("starts from the saved graph while the first run still holds its token", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      details: { level: "basic", purpose: "overview" },
      planRevealedAt: null,
      userId: user.id,
    });

    const plan = await planFixture({ goalId: goal.id });
    const followUp = await owedRebuild(goal.id, user.id);

    const firstId = await startOnce(
      heldInitialCurriculum,
      [],
      getGoalContentToken({ goalId: goal.id }),
    );

    const first = getRun(firstId);
    const firstSleep = await waitForSleep(first);
    const model = Promise.withResolvers<Awaited<ReturnType<typeof classifyGoalSpecificity>>>();
    void model.promise.catch(() => null);

    vi.mocked(classifyGoalSpecificity)
      .mockReset()
      .mockImplementation(() => model.promise);

    const rebuildId = await startOnce(
      rebuildGoalCurriculumWorkflow,
      [{ followUp, goalId: goal.id }],
      `rebuild-ask:${goal.id}`,
    );

    const rebuild = getRun(rebuildId);

    try {
      const waiting = await waitForSleep(rebuild);
      const skill = await skillFixture();

      await prisma.plan.update({
        data: {
          graph: {
            phases: [{ milestone: null, name: "Foundations" }],
            skills: plannedSkills([skill]),
          },
        },
        where: { id: plan.id },
      });

      await rebuild.wakeUp({ correlationIds: [waiting] });

      await vi.waitFor(() => expect(classifyGoalSpecificity).toHaveBeenCalledOnce(), {
        timeout: 3000,
      });

      await expect(first.status).resolves.toBe("running");
    } finally {
      await rebuild.cancel();
      model.reject(new Error("Stopped after proving the saved-graph boundary"));
      await first.wakeUp({ correlationIds: [firstSleep] });
      await first.returnValue;
    }
  });
});
