import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";

const ADMITTED = new Date("2026-11-01T12:00:00Z");
const STARTED = new Date("2026-11-03T12:00:00Z");

describe("legacy lesson claims", () => {
  it("backfills only starts and retained map requests, leaving unproven generation uncounted", async () => {
    const user = await userFixture();

    const [direct, started, mapped, unproven] = await Promise.all(
      [false, true, true, true].map((generated) =>
        prisma.usageRecord.create({
          data: {
            countedAt: null,
            createdAt: ADMITTED,
            generated,
            kind: "lessonStart",
            targetId: randomUUID(),
            userId: user.id,
          },
        }),
      ),
    );

    if (!direct || !started || !mapped || !unproven) {
      throw new Error("Missing legacy fixture");
    }

    await prisma.learningEvent.create({
      data: {
        contentIds: { lessonId: started.targetId },
        hour: 12,
        kind: "lesson",
        localDate: STARTED,
        startedAt: STARTED,
        userId: user.id,
        weekday: 2,
      },
    });

    await prisma.followUp.create({
      data: {
        input: { launch: { lessonIds: [mapped.targetId] } },
        key: randomUUID(),
        kind: "makeChapterMindMap",
        userId: user.id,
      },
    });

    const migration = readFileSync(
      new URL(
        "../../../db/src/prisma/migrations/20261114022621_lesson_counted_at/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    const backfill = `UPDATE usage_records AS claim${migration.split("UPDATE usage_records AS claim")[1]}`;
    // The migration is global; integration fixtures share a database with parallel test files.
    const forLearner = backfill.replace(/;\s*$/u, " AND claim.user_id = $1::uuid;");
    await prisma.$executeRawUnsafe(forLearner, user.id);
    const rows = await prisma.usageRecord.findMany({ where: { userId: user.id } });
    expect(rows.find((row) => row.id === direct.id)?.countedAt).toStrictEqual(ADMITTED);
    expect(rows.find((row) => row.id === started.id)?.countedAt).toStrictEqual(STARTED);
    expect(rows.find((row) => row.id === mapped.id)?.countedAt).toStrictEqual(ADMITTED);
    expect(rows.find((row) => row.id === unproven.id)?.countedAt).toBeNull();
  });
});
