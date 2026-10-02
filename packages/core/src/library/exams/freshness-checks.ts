import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { type FreshnessTarget } from "./check-freshness";
import { type FreshnessCommandAccess, getFreshnessCommandAccess } from "./freshness-access";

/** The sweep runs once a day, so a check due before tomorrow's sweep runs in today's. */
const SWEEP_INTERVAL_MS = MS_PER_DAY;
/** A sweep checks at most this many of each kind; the next sweep takes the rest. */
const MAX_DUE_TARGETS = 200;

/**
 * Starts checking an exam or sources a learner's goal now relies on: the first check runs at the
 * next daily sweep and sets the schedule. Ones that already have a check scheduled keep it. A
 * bridge for the research workflow, which found them for the goal.
 */
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

/**
 * An admin's "Stop": nothing is checked until a learner's goal schedules it again. Returns the
 * command's access, `ready` once stopped.
 */
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

/**
 * The exams and sources whose next check falls before the next daily sweep, the latest due first
 * (anything left stays due for the next sweep). A check a few hours early costs a fetch and a
 * hash compare, while waiting for the following sweep would make a daily check skip a day
 * whenever the cron starts a little before it was due. A bridge for the daily sweep.
 */
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
