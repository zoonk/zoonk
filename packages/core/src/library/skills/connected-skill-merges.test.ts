import { prisma, sql } from "@zoonk/db";
import { skillFixture, skillPrerequisiteFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { waitForBlockedStatement } from "../../_test-utils/learner-lock";
import { getSession } from "../../users/get-session";
import { setSkillsPrerequisites } from "./create-skill";
import { mergeSkillForAdmin } from "./merge-skill";

const GATE_NAMESPACE = 1_553_971;

// Leave these row-scoped triggers to run-database cleanup: dropping them here can block unrelated tests on an exclusive table lock.
describe("concurrent merges joined by a prerequisite", () => {
  it.each(Array.from({ length: 10 }, (_, index) => index))(
    "completes both connected merges without a deadlock (%i)",
    async () => {
      const [first, firstSurvivor, second, secondSurvivor, admin] = await Promise.all([
        skillFixture(),
        skillFixture(),
        skillFixture(),
        skillFixture(),
        userFixture({ role: "admin" }),
      ]);

      await skillPrerequisiteFixture({ prerequisiteId: second.id, skillId: first.id });

      vi.mocked(getSession).mockResolvedValue(
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Merges read the trusted admin identity and role.
        { user: { id: admin.id, role: "admin" } } as Awaited<ReturnType<typeof getSession>>,
      );

      const key = crypto.randomUUID();
      const trigger = `merge_gate_${key.replaceAll("-", "")}`;

      await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_advisory_xact_lock(${GATE_NAMESPACE}, hashtext('${key}')); RETURN NEW; END; $$`);

      await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON skill_prerequisites
      FOR EACH ROW WHEN ((NEW.skill_id = '${firstSurvivor.id}' AND NEW.prerequisite_id = '${second.id}')
        OR (NEW.skill_id = '${first.id}' AND NEW.prerequisite_id = '${secondSurvivor.id}'))
      EXECUTE FUNCTION ${trigger}()`);

      const held = Promise.withResolvers<number>();
      const resume = Promise.withResolvers<null>();

      const gate = prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
          sql`SELECT pg_advisory_xact_lock(${GATE_NAMESPACE}::int, hashtext(${key}))::text`,
        );

        const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        held.resolve(backend!.pid);
        await resume.promise;
      });

      const pid = await held.promise;

      const outcomes = Promise.allSettled([
        mergeSkillForAdmin({ duplicateId: first.id, survivorId: firstSurvivor.id }),
        mergeSkillForAdmin({ duplicateId: second.id, survivorId: secondSurvivor.id }),
      ]);

      try {
        await waitForBlockedStatement(
          pid,
          /(?:skill_prerequisites|FROM skills[\s\S]*FOR UPDATE)/u,
          2,
        );
      } finally {
        resume.resolve(null);
        await Promise.all([gate, outcomes]);
      }

      const results = await outcomes;
      const failure = results.find((outcome) => outcome.status === "rejected");

      if (failure?.status === "rejected") {
        throw failure.reason;
      }

      await expect(
        prisma.skillPrerequisite.findMany({ where: { skillId: firstSurvivor.id } }),
      ).resolves.toMatchObject([{ prerequisiteId: secondSurvivor.id }]);

      await expect(
        prisma.skill.findUniqueOrThrow({ where: { id: first.id } }),
      ).resolves.toMatchObject({ mergedIntoId: firstSurvivor.id });

      await expect(
        prisma.skill.findUniqueOrThrow({ where: { id: second.id } }),
      ).resolves.toMatchObject({ mergedIntoId: secondSurvivor.id });
    },
  );
});

describe("concurrent prerequisite writes with new endpoints", () => {
  it.each(Array.from({ length: 10 }, (_, index) => index))(
    "locks the new endpoints before either acyclic write inserts (%i)",
    async () => {
      const [a, b, x, y] = await Promise.all(Array.from({ length: 4 }, () => skillFixture()));

      await prisma.skillPrerequisite.createMany({
        data: [
          { prerequisiteId: x!.id, skillId: a!.id },
          { prerequisiteId: y!.id, skillId: b!.id },
        ],
      });

      const key = crypto.randomUUID();
      const trigger = `prerequisite_gate_${key.replaceAll("-", "")}`;

      await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN PERFORM pg_advisory_xact_lock_shared(${GATE_NAMESPACE}, hashtext('${key}')); RETURN NEW; END; $$`);

      await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON skill_prerequisites
        FOR EACH ROW WHEN ((NEW.skill_id = '${a!.id}' AND NEW.prerequisite_id = '${b!.id}')
          OR (NEW.skill_id = '${b!.id}' AND NEW.prerequisite_id = '${x!.id}'))
        EXECUTE FUNCTION ${trigger}()`);

      const held = Promise.withResolvers<number>();
      const resume = Promise.withResolvers<null>();

      const gate = prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
          sql`SELECT pg_advisory_xact_lock(${GATE_NAMESPACE}::int, hashtext(${key}))::text`,
        );

        const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        held.resolve(backend!.pid);
        await resume.promise;
      });

      const pid = await held.promise;
      const among = new Set([a!.id, b!.id, x!.id, y!.id]);

      const outcomes = Promise.allSettled([
        setSkillsPrerequisites({ among, prerequisitesBySkill: new Map([[a!.id, [x!.id, b!.id]]]) }),
        setSkillsPrerequisites({ among, prerequisitesBySkill: new Map([[b!.id, [y!.id, x!.id]]]) }),
      ]);

      try {
        await waitForBlockedStatement(
          pid,
          /(?:skill_prerequisites|FROM skills[\s\S]*FOR UPDATE)/u,
          2,
        );
      } finally {
        resume.resolve(null);
        await Promise.all([gate, outcomes]);
      }

      const results = await outcomes;
      const failure = results.find((outcome) => outcome.status === "rejected");

      if (failure?.status === "rejected") {
        throw failure.reason;
      }

      const edges = await prisma.skillPrerequisite.findMany({
        where: { skillId: { in: [a!.id, b!.id] } },
      });

      expect(
        edges.map(({ skillId, prerequisiteId }) => `${skillId}:${prerequisiteId}`).toSorted(),
      ).toStrictEqual(
        [
          `${a!.id}:${x!.id}`,
          `${a!.id}:${b!.id}`,
          `${b!.id}:${y!.id}`,
          `${b!.id}:${x!.id}`,
        ].toSorted(),
      );
    },
  );
});

describe("parallel curriculum prerequisites", () => {
  it("saves an acyclic graph's prerequisites together without treating incoming edges as rewritten sources", async () => {
    const skills = await Promise.all(Array.from({ length: 3 }, () => skillFixture()));
    const among = new Set(skills.map(({ id }) => id));

    await Promise.all(
      skills.map((skill, index) =>
        setSkillsPrerequisites({
          among,
          prerequisitesBySkill: new Map([[skill.id, skills.slice(0, index).map(({ id }) => id)]]),
        }),
      ),
    );

    await expect(
      prisma.skillPrerequisite.count({ where: { skillId: { in: [...among] } } }),
    ).resolves.toBe(3);
  });
});
