import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { type FreshnessTarget } from "./check-freshness";
import { type FreshnessCommandAccess, getFreshnessCommandAccess } from "./freshness-access";

const SWEEP_INTERVAL_MS = MS_PER_DAY;
const MAX_DUE_TARGETS = 200;

/** Internal bridge for the research workflow that found the goal's sources. */
export async function scheduleFreshnessChecks({
  now = new Date(),
  targets,
}: {
  now?: Date;
  targets: FreshnessTarget[];
}): Promise<void> {
  const examIds = targets.flatMap((target) =>
    target.kind === "exam" ? [target.examBlueprintId] : [],
  );

  const sourceIds = targets.flatMap((target) =>
    target.kind === "source" ? [target.sourceId] : [],
  );

  await Promise.all([
    examIds.length > 0
      ? prisma.examBlueprint.updateMany({
          data: { nextCheckAt: now },
          where: { id: { in: examIds }, nextCheckAt: null },
        })
      : null,
    sourceIds.length > 0
      ? prisma.source.updateMany({
          data: { nextCheckAt: now },
          where: { id: { in: sourceIds }, nextCheckAt: null },
        })
      : null,
  ]);
}

export async function stopFreshnessChecks(
  target: FreshnessTarget,
): Promise<FreshnessCommandAccess> {
  const access = await getFreshnessCommandAccess(target);

  if (access !== "ready") {
    return access;
  }

  await (target.kind === "exam"
    ? prisma.examBlueprint.updateMany({
        data: { nextCheckAt: null },
        where: { id: target.examBlueprintId },
      })
    : prisma.source.updateMany({ data: { nextCheckAt: null }, where: { id: target.sourceId } }));

  return access;
}

/** Internal bridge for the daily sweep; includes checks due before the next sweep. */
export async function listDueFreshnessTargets({ now = new Date() }: { now?: Date } = {}): Promise<
  FreshnessTarget[]
> {
  const where = { nextCheckAt: { lt: new Date(now.getTime() + SWEEP_INTERVAL_MS) } };

  const [exams, sources] = await Promise.all([
    prisma.examBlueprint.findMany({
      orderBy: { nextCheckAt: "desc" },
      select: { id: true },
      take: MAX_DUE_TARGETS,
      where,
    }),
    prisma.source.findMany({
      orderBy: { nextCheckAt: "desc" },
      select: { id: true },
      take: MAX_DUE_TARGETS,
      where,
    }),
  ]);

  return [
    ...exams.map((exam) => ({ examBlueprintId: exam.id, kind: "exam" as const })),
    ...sources.map((source) => ({ kind: "source" as const, sourceId: source.id })),
  ];
}
