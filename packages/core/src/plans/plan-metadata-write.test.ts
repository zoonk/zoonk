import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { unplannedGoalFixture } from "./_test-utils/plan-library";
import { writePlanMetadata } from "./_utils/plan-metadata-write";
import { PlanConflictError } from "./_utils/write-plan";

async function setup() {
  const user = await userFixture();
  const { plan } = await unplannedGoalFixture({ userId: user.id });
  return { plan, user };
}

describe("plan metadata uses the same transactional version guard", () => {
  it("marks the affected plan and owner once before saving its proposal", async () => {
    const { plan, user } = await setup();

    const created = await writePlanMetadata({
      plan,
      write: (tx) =>
        tx.planChange.create({
          data: { kind: "edited", payload: {}, planId: plan.id, reason: "", status: "proposed" },
        }),
    });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion + 1,
      version: plan.version,
    });

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
      learnerRevision: user.learnerRevision + 1n,
    });

    await expect(
      prisma.planChange.findUnique({ where: { id: created.id } }),
    ).resolves.toMatchObject({ planId: plan.id, status: "proposed" });
  });

  it("a stale proposal rolls back its revision mark and writes nothing", async () => {
    const { plan, user } = await setup();

    await writePlanMetadata({
      plan,
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

    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const actor = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    await expect(
      writePlanMetadata({
        plan,
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
    const { plan, user } = await setup();
    const actor = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    await expect(
      writePlanMetadata({
        plan,
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
