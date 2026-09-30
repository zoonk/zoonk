import { prisma } from "@zoonk/db";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { getSession } from "../../users/get-session";
import {
  listDueFreshnessTargets,
  scheduleFreshnessChecks,
  stopFreshnessChecks,
} from "./freshness-checks";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

const HOUR_MS = 3_600_000;

/** Far from the dates other tests store, so only this test's rows are due at it. */
const SWEEP_AT = new Date("1990-06-01T06:00:00.000Z");

function mockSessionWithRole({ role, userId }: { role: "admin" | "user"; userId: string }) {
  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only the identity and role are read.
    { user: { id: userId, role } } as Awaited<ReturnType<typeof getSession>>,
  );
}

function hoursFromSweep(hours: number): Date {
  return new Date(SWEEP_AT.getTime() + hours * HOUR_MS);
}

describe(listDueFreshnessTargets, () => {
  it("finds every exam and source due before the next daily sweep, the latest due first", async () => {
    const [overdueExam, laterTodayExam, tomorrowExam, overdueSource, unscheduledSource] =
      await Promise.all([
        examBlueprintFixture({ nextCheckAt: hoursFromSweep(-48) }),
        examBlueprintFixture({ nextCheckAt: hoursFromSweep(23) }),
        examBlueprintFixture({ nextCheckAt: hoursFromSweep(25) }),
        sourceFixture({ nextCheckAt: hoursFromSweep(-1) }),
        sourceFixture({ nextCheckAt: null }),
      ]);

    try {
      const targets = await listDueFreshnessTargets({ now: SWEEP_AT });

      expect(targets).toStrictEqual([
        { examBlueprintId: laterTodayExam.id, kind: "exam" },
        { examBlueprintId: overdueExam.id, kind: "exam" },
        { kind: "source", sourceId: overdueSource.id },
      ]);

      expect(targets).not.toContainEqual({ examBlueprintId: tomorrowExam.id, kind: "exam" });
      expect(targets).not.toContainEqual({ kind: "source", sourceId: unscheduledSource.id });
    } finally {
      // Rows dated around 1990 would be due in this test's later runs, so they don't outlive it.
      await Promise.all([
        prisma.examBlueprint.deleteMany({
          where: { id: { in: [overdueExam.id, laterTodayExam.id, tomorrowExam.id] } },
        }),
        prisma.source.deleteMany({
          where: { id: { in: [overdueSource.id, unscheduledSource.id] } },
        }),
      ]);
    }
  });
});

describe(scheduleFreshnessChecks, () => {
  it("makes unscheduled exams and sources due at the next sweep and keeps existing schedules", async () => {
    const now = new Date();
    const scheduled = new Date(now.getTime() + 72 * HOUR_MS);

    const [exam, source, scheduledSource] = await Promise.all([
      examBlueprintFixture({ nextCheckAt: null }),
      sourceFixture({ nextCheckAt: null }),
      sourceFixture({ nextCheckAt: scheduled }),
    ]);

    await scheduleFreshnessChecks({
      now,
      targets: [
        { examBlueprintId: exam.id, kind: "exam" },
        { kind: "source", sourceId: source.id },
        { kind: "source", sourceId: scheduledSource.id },
      ],
    });

    const [storedExam, storedSources] = await Promise.all([
      prisma.examBlueprint.findUniqueOrThrow({ where: { id: exam.id } }),
      prisma.source.findMany({ where: { id: { in: [source.id, scheduledSource.id] } } }),
    ]);

    expect(storedExam.nextCheckAt).toStrictEqual(now);
    expect(storedSources.find((row) => row.id === source.id)?.nextCheckAt).toStrictEqual(now);

    expect(storedSources.find((row) => row.id === scheduledSource.id)?.nextCheckAt).toStrictEqual(
      scheduled,
    );
  });
});

describe(stopFreshnessChecks, () => {
  it("clears an exam's or a source's next check, for admins only", async () => {
    const nextCheckAt = new Date(Date.now() + HOUR_MS);

    const [admin, learner, exam, source] = await Promise.all([
      userFixture({ role: "admin" }),
      userFixture(),
      examBlueprintFixture({ nextCheckAt }),
      sourceFixture({ nextCheckAt }),
    ]);

    const examTarget = { examBlueprintId: exam.id, kind: "exam" as const };
    mockSessionWithRole({ role: "user", userId: learner.id });

    await expect(stopFreshnessChecks(examTarget)).resolves.toBe("forbidden");

    await expect(
      prisma.examBlueprint.findUniqueOrThrow({ where: { id: exam.id } }),
    ).resolves.toMatchObject({ nextCheckAt });

    mockSessionWithRole({ role: "admin", userId: admin.id });

    await expect(
      Promise.all([
        stopFreshnessChecks(examTarget),
        stopFreshnessChecks({ kind: "source", sourceId: source.id }),
      ]),
    ).resolves.toStrictEqual(["ready", "ready"]);

    const [storedExam, storedSource] = await Promise.all([
      prisma.examBlueprint.findUniqueOrThrow({ where: { id: exam.id } }),
      prisma.source.findUniqueOrThrow({ where: { id: source.id } }),
    ]);

    expect(storedExam.nextCheckAt).toBeNull();
    expect(storedSource.nextCheckAt).toBeNull();
  });
});
