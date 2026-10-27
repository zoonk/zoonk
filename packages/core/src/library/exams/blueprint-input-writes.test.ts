import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { waitForBlockedStatement } from "../../_test-utils/learner-lock";
import { createGoal } from "../../goals/_utils/create-goal-records";
import { buildExamIdentityKey } from "./exam-identity";
import { linkGoalToExamBlueprint } from "./exam-learners";
import { readBlueprintContent, saveExamBlueprint } from "./save-exam-blueprint";

describe("blueprint inputs while its writer waits", () => {
  it.each(["create", "link"] as const)(
    "marks a plan whose goal arrived through %s while it waited",
    async (registration) => {
      const [firstUser, arrivingUser, source] = await Promise.all([
        userFixture(),
        userFixture(),
        sourceFixture(),
      ]);

      const identity = {
        board: null,
        country: "BR",
        language: "en",
        name: crypto.randomUUID(),
        ownerId: null,
        role: null,
      };

      const blueprint = await examBlueprintFixture({ identityKey: buildExamIdentityKey(identity) });
      const goal = await goalFixture({ examBlueprintId: blueprint.id, userId: firstUser.id });
      const plan = await planFixture({ goalId: goal.id });
      const arrivingId = crypto.randomUUID();

      if (registration === "link") {
        await prisma.$transaction(async (tx) => {
          await tx.goal.create({
            data: {
              dailyMinutes: 20,
              id: arrivingId,
              kind: "exam",
              language: "en",
              prompt: "Test exam",
              title: "Test exam",
              userId: arrivingUser.id,
            },
          });

          await tx.plan.create({ data: { goalId: arrivingId } });
        });
      }

      const held = Promise.withResolvers<number>();
      const resume = Promise.withResolvers<null>();

      const holder = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM plans WHERE id = ${plan.id}::uuid FOR UPDATE`;
        const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        held.resolve(backend!.pid);
        await resume.promise;
      });

      const pid = await held.promise;
      const content = readBlueprintContent(blueprint);

      const writing = saveExamBlueprint({
        content: {
          ...content,
          edition: { ...content.edition, questionCount: 42, sourceHash: source.contentHash },
        },
        identity,
        provenance: {
          generatedAt: new Date(),
          model: "test/fixture",
          promptVersion: "test",
          runId: crypto.randomUUID(),
        },
        sourceId: source.id,
      });

      try {
        await waitForBlockedStatement(pid, /FROM plans AS plan[\s\S]*FOR UPDATE/u);

        if (registration === "create") {
          await createGoal({
            dailyMinutes: 20,
            draft: {
              examBlueprintId: blueprint.id,
              kind: "exam",
              language: "en",
              prompt: "Test exam",
              title: "Test exam",
            },
            id: arrivingId,
            input: { dailyMinutes: 20, goals: [] },
            testedLanguage: null,
            userId: arrivingUser.id,
          });
        } else {
          await linkGoalToExamBlueprint({ examBlueprintId: blueprint.id, goalId: arrivingId });
        }
      } finally {
        resume.resolve(null);
        await Promise.all([holder, writing]);
      }

      await expect(
        prisma.goal.findUniqueOrThrow({ where: { id: arrivingId } }),
      ).resolves.toMatchObject({ examBlueprintId: blueprint.id });

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { goalId: arrivingId } }),
      ).resolves.toMatchObject({ inputVersion: registration === "create" ? 1 : 2 });

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      ).resolves.toMatchObject({ inputVersion: 1 });

      await expect(
        prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprint.id } }),
      ).resolves.toMatchObject({ edition: expect.objectContaining({ questionCount: 42 }) });
    },
  );
});
