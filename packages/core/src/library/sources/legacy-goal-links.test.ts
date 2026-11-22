import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";

/** The release still running writes a goal's material on the learner's link, as raw SQL here. */
describe("goal links the previous release writes", () => {
  it("copies a goal and an answer written on the learner's link into the goal's sources", async () => {
    const user = await userFixture();
    const [goal, source] = await Promise.all([goalFixture({ userId: user.id }), sourceFixture()]);

    await prisma.$executeRaw`
      INSERT INTO learner_sources (user_id, source_id, goal_id, origin)
      VALUES (${user.id}::uuid, ${source.id}::uuid, ${goal.id}::uuid, 'upload')
    `;

    const answeredAt = new Date("2026-11-20T10:00:00.000Z");

    await prisma.$executeRaw`
      UPDATE learner_sources SET answered_at = ${answeredAt}
      WHERE user_id = ${user.id}::uuid AND source_id = ${source.id}::uuid
    `;

    await expect(
      prisma.goalSource.findMany({
        select: { answeredAt: true, goalId: true, origin: true },
        where: { sourceId: source.id },
      }),
    ).resolves.toStrictEqual([{ answeredAt, goalId: goal.id, origin: "upload" }]);
  });

  it("keeps a research find for a goal research when the learner's upload of it answers that goal", async () => {
    const user = await userFixture();
    const [goal, source] = await Promise.all([goalFixture({ userId: user.id }), sourceFixture()]);

    await learnerSourceFixture({
      goalId: goal.id,
      origin: "research",
      sourceId: source.id,
      userId: user.id,
    });

    await prisma.$executeRaw`
      UPDATE learner_sources SET origin = 'upload', goal_id = ${goal.id}::uuid, answered_at = now()
      WHERE user_id = ${user.id}::uuid AND source_id = ${source.id}::uuid
    `;

    await expect(
      prisma.goalSource.findUniqueOrThrow({
        where: { goalId_sourceId: { goalId: goal.id, sourceId: source.id } },
      }),
    ).resolves.toMatchObject({ answeredAt: expect.any(Date), origin: "research" });
  });

  it("keeps a goal's material when that release merges the upload into its shared copy", async () => {
    const user = await userFixture();

    const [goal, upload, shared] = await Promise.all([
      goalFixture({ userId: user.id }),
      sourceFixture({ kind: "upload", ownerId: user.id, visibility: "private" }),
      sourceFixture(),
    ]);

    await learnerSourceFixture({ goalId: goal.id, sourceId: upload.id, userId: user.id });

    await prisma.$transaction([
      prisma.$executeRaw`
        UPDATE learner_sources SET source_id = ${shared.id}::uuid WHERE source_id = ${upload.id}::uuid
      `,
      prisma.source.delete({ where: { id: upload.id } }),
    ]);

    await expect(
      prisma.goalSource.findMany({
        select: { origin: true, sourceId: true },
        where: { goalId: goal.id },
      }),
    ).resolves.toStrictEqual([{ origin: "upload", sourceId: shared.id }]);
  });

  it("links no goal of another learner's", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);
    const [goal, source] = await Promise.all([goalFixture({ userId: other.id }), sourceFixture()]);

    await prisma.$executeRaw`
      INSERT INTO learner_sources (user_id, source_id, goal_id, origin)
      VALUES (${user.id}::uuid, ${source.id}::uuid, ${goal.id}::uuid, 'upload')
    `;

    await expect(prisma.goalSource.count({ where: { sourceId: source.id } })).resolves.toBe(0);
  });
});
