import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, plannedSkills } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import * as logger from "@zoonk/utils/logger";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { getWorld } from "workflow/runtime";
import { examNoticePlansWorkflow } from "./exam-notice-plans-workflow";

describe(examNoticePlansWorkflow, () => {
  it("retries a failed goal, logs its failure and repairs the next goal", async () => {
    const [blueprint, firstUser, secondUser, official, outside] = await Promise.all([
      examBlueprintFixture({
        structure: {
          formats: [],
          mock: null,
          rules: [],
          subjects: [
            {
              citation: { passage: "", sourceId: "notice" },
              name: "Finance",
              questions: 1,
              topics: ["Budgets"],
              weight: 1,
            },
          ],
        },
      }),
      userFixture(),
      userFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    const goals = await Promise.all(
      [firstUser, secondUser].map(({ id }) =>
        goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: id }),
      ),
    );

    const [first, second] = goals.toSorted((a, b) => a.id.localeCompare(b.id));
    const [required, beyond] = plannedSkills([official, outside]);
    const kept = { ...required, area: "Finance", skillId: official.id, topics: ["Budgets"] };

    const graph = {
      phases: [{ milestone: null, name: "Exam" }],
      skills: [kept, { ...beyond, area: "Strategy", skillId: outside.id, topics: [] }],
    };

    const [blocked, later] = await Promise.all([
      planFixture({ goalId: first!.id, graph }),
      planFixture({ goalId: second!.id, graph }),
    ]);

    // A constraint on one fixture gives the real Workflow runtime a persistent write failure.
    await prisma.$executeRawUnsafe(
      `ALTER TABLE plans ADD CONSTRAINT blocked_notice_repair CHECK (id <> '${blocked.id}' OR input_version <= ${blocked.inputVersion}) NOT VALID`,
    );

    const log = vi.spyOn(logger, "logError");

    try {
      const run = await start(examNoticePlansWorkflow, [{ examBlueprintId: blueprint.id }]);
      await expect(run.returnValue).resolves.toBeUndefined();

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { id: blocked.id } }),
      ).resolves.toMatchObject({ graph });

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { id: later.id } }),
      ).resolves.toMatchObject({ graph: { skills: [kept] } });

      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("notice"),
        expect.objectContaining({ blueprintId: blueprint.id, goalId: first!.id }),
      );

      const world = await getWorld();

      const steps = await world.steps.list({
        pagination: { limit: 100 },
        resolveData: "none",
        runId: run.runId,
      });

      expect(steps.data).toContainEqual(
        expect.objectContaining({
          attempt: 4,
          status: "failed",
          stepName: expect.stringContaining("repairNoticePlanStep"),
        }),
      );
    } finally {
      log.mockRestore();
      await prisma.$executeRaw`ALTER TABLE plans DROP CONSTRAINT blocked_notice_repair`;
    }
  });
});
