import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { markPlansChanged } from "../learner/_utils/mark-learner-changed";
import { unplannedGoalFixture } from "./_test-utils/plan-library";
import { writePlanMetadata } from "./_utils/plan-metadata-write";
import { loadPlanAtToken } from "./_utils/plan-token";
import { PlanConflictError } from "./plan-conflict";

async function setup() {
  const user = await userFixture();
  const { goal, plan } = await unplannedGoalFixture({ userId: user.id });
  const context = await loadPlanAtToken(goal.id);

  if (!context) {
    throw new Error("Expected the plan context");
  }

  return { context, plan, user };
}

describe("plan metadata uses the same transactional version guard", () => {
  it("locks the affected plan and owner without dirtying its planning inputs", async () => {
    const { context, plan } = await setup();

    const created = await writePlanMetadata({
      context,
      write: (tx) =>
        tx.planChange.create({
          data: { kind: "edited", payload: {}, planId: plan.id, reason: "", status: "proposed" },
        }),
    });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion,
      version: plan.version,
    });

    await expect(
      prisma.planChange.findUnique({ where: { id: created.id } }),
    ).resolves.toMatchObject({ planId: plan.id, status: "proposed" });
  });

  it("a stale proposal rolls back its marks and writes nothing", async () => {
    const { context, plan, user } = await setup();

    await writePlanMetadata({
      context,
      write: (tx) =>
        tx.planChange.create({
          data: {
            kind: "edited",
            payload: {},
            planId: plan.id,
            reason: "winner",
            status: "proposed",
          },
        }),
    });

    await prisma.$transaction((tx) => markPlansChanged(tx, { planIds: [plan.id] }));

    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const actor = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    await expect(
      writePlanMetadata({
        context,
        write: (tx) =>
          tx.planChange.create({
            data: {
              kind: "edited",
              payload: {},
              planId: plan.id,
              reason: "stale",
              status: "proposed",
            },
          }),
      }),
    ).rejects.toBeInstanceOf(PlanConflictError);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toStrictEqual(
      before,
    );

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toStrictEqual(
      actor,
    );

    await expect(prisma.planChange.findMany({ where: { planId: plan.id } })).resolves.toMatchObject(
      [{ reason: "winner" }],
    );
  });

  it("a failed metadata transaction preserves both versions and removes its new proposal", async () => {
    const { context, plan, user } = await setup();
    const actor = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    await expect(
      writePlanMetadata({
        context,
        write: async (tx) => {
          await tx.planChange.create({
            data: { kind: "edited", payload: {}, planId: plan.id, reason: "", status: "proposed" },
          });

          throw new Error("Abort this metadata transaction");
        },
      }),
    ).rejects.toThrow("Abort this metadata transaction");

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toStrictEqual(
      plan,
    );

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toStrictEqual(
      actor,
    );

    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
  });
});
