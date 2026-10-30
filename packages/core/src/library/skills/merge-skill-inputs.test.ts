import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { waitForBlockedStatement } from "../../_test-utils/learner-lock";
import { getSession } from "../../users/get-session";
import { setSkillsPrerequisites } from "./create-skill";
import { mergeSkillForAdmin } from "./merge-skill";

async function planFor(skillId: string) {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });
  const plan = await planFixture({ goalId: goal.id, sourceSkillIds: [skillId] });
  return { plan, user };
}

describe("a merge's inputs while it waits", () => {
  it.each(["merge", "prerequisites"] as const)(
    "rechecks newly arriving aliases and mastery before %s writes",
    async (writer) => {
      const [incoming, duplicate, survivor, admin] = await Promise.all([
        skillFixture(),
        skillFixture(),
        skillFixture(),
        userFixture({ role: "admin" }),
      ]);

      const [incomingPlan, duplicatePlan, survivorPlan, masteryPlan] = await Promise.all([
        planFor(incoming.id),
        planFor(duplicate.id),
        planFor(survivor.id),
        planFor(crypto.randomUUID()),
      ]);

      await learnerSkillFixture({ skillId: incoming.id, userId: masteryPlan.user.id });

      vi.mocked(getSession).mockResolvedValue(
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The merge boundary reads trusted identity and role.
        { user: { id: admin.id, role: "admin" } } as Awaited<ReturnType<typeof getSession>>,
      );

      const held = Promise.withResolvers<number>();
      const resume = Promise.withResolvers<null>();

      const gate = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM skills WHERE id = ${incoming.id}::uuid FOR UPDATE`;
        const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        held.resolve(backend!.pid);
        await resume.promise;
      });

      const pid = await held.promise;
      const first = mergeSkillForAdmin({ duplicateId: incoming.id, survivorId: duplicate.id });
      const writes: Promise<unknown>[] = [first];
      let stage = "incoming merge source lock";

      try {
        await waitForBlockedStatement(pid, /(?:FROM skills|UPDATE "public"\."skills")/u);

        writes.push(
          writer === "merge"
            ? mergeSkillForAdmin({ duplicateId: duplicate.id, survivorId: survivor.id })
            : setSkillsPrerequisites({
                among: new Set([survivor.id]),
                prerequisitesBySkill: new Map([[duplicate.id, [survivor.id]]]),
              }),
        );

        stage = "second writer plan lock";
        await waitForBlockedStatement(pid, /FROM plans AS plan[\s\S]*FOR UPDATE/u);
      } catch (error) {
        const activity = await prisma.$queryRaw`
          SELECT pid, query, wait_event_type, wait_event, pg_blocking_pids(pid) AS blockers
          FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()
        `;

        throw new Error(`${stage}: ${JSON.stringify(activity)}`, { cause: error });
      } finally {
        resume.resolve(null);
        await Promise.all([gate, ...writes]);
      }

      await expect(first).resolves.toMatchObject({ status: "merged" });

      await Promise.all(
        [
          { expected: 2, plan: incomingPlan.plan },
          { expected: 2, plan: duplicatePlan.plan },
          { expected: writer === "merge" ? 1 : 0, plan: survivorPlan.plan },
          { expected: writer === "merge" ? 2 : 1, plan: masteryPlan.plan },
        ].map(({ plan, expected }) =>
          expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
            inputVersion: expected,
          }),
        ),
      );

      await expect(
        prisma.learnerSkill.findFirstOrThrow({ where: { userId: masteryPlan.user.id } }),
      ).resolves.toMatchObject({ skillId: writer === "merge" ? survivor.id : duplicate.id });

      await expect(
        prisma.skill.findUniqueOrThrow({ where: { id: incoming.id } }),
      ).resolves.toMatchObject({ mergedIntoId: writer === "merge" ? survivor.id : duplicate.id });
    },
  );
});
