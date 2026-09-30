import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { getNextExamCheck, getNextSourceCheck } from "../sources/freshness-schedule";
import { refreshWebSource } from "../sources/web-sources";
import { countActiveExamGoals, countActiveSourceGoals } from "./exam-learners";
import { readBlueprintContent } from "./save-exam-blueprint";

/** What gets checked for freshness: an exam blueprint, or a source that isn't an exam notice. */
export type FreshnessTarget =
  | { examBlueprintId: string; kind: "exam" }
  | { kind: "source"; sourceId: string };

export type FreshnessStopReason = "examPassed" | "missing" | "noLearners" | "noUrl";

export type SourceChange = {
  change: string | null;
  contentHash: string;
  language: string;
  previousHash: string;
  sourceId: string;
  title: string;
};

/** Plain JSON, since a workflow step returns it. */
export type FreshnessCheck =
  | { reason: FreshnessStopReason; status: "stopped" }
  | {
      /** Set when the blueprint was read from an older version of its notice. */
      blueprintUpdate: { examBlueprintId: string; sourceId: string } | null;
      nextCheckAt: string;
      sourceChange: SourceChange | null;
      status: "scheduled";
    };

/**
 * A failed fetch (the board's site is down) must not stop the checks, so it's
 * logged and the source is simply checked again at the next scheduled time.
 */
async function refreshSafely(sourceId: string) {
  const { data, error } = await safeAsync(() => refreshWebSource(sourceId));

  if (error) {
    logError(`Freshness check for source ${sourceId} failed; retrying at the next check.`, error);
  }

  return data;
}

function getRegistrationStart(dates: { date: string; kind: string }[]): Date | null {
  const start = dates.find((date) => date.kind === "registrationStart");
  return start ? new Date(`${start.date}T00:00:00.000Z`) : null;
}

function getExamStopReason({
  learners,
  stop,
  url,
}: {
  learners: number;
  stop: "examPassed" | null;
  url: string | null | undefined;
}): FreshnessStopReason | null {
  if (stop) {
    return stop;
  }

  if (learners === 0) {
    return "noLearners";
  }

  return url ? null : "noUrl";
}

function getSourceStopReason({
  learners,
  url,
}: {
  learners: number;
  url: string | null | undefined;
}): FreshnessStopReason | null {
  if (!url) {
    return "noUrl";
  }

  return learners === 0 ? "noLearners" : null;
}

/** A failed fetch is checked again tomorrow instead of waiting a whole week. */
function getNextCheckAfterRefresh({
  now,
  refreshed,
  scheduled,
}: {
  now: Date;
  refreshed: boolean;
  scheduled: Date;
}): Date {
  return refreshed ? scheduled : new Date(now.getTime() + MS_PER_DAY);
}

async function checkExam({
  examBlueprintId,
  now,
}: {
  examBlueprintId: string;
  now: Date;
}): Promise<FreshnessCheck> {
  const blueprint = await prisma.examBlueprint.findUnique({
    include: { source: { select: { contentHash: true, id: true, url: true } } },
    where: { id: examBlueprintId },
  });

  if (!blueprint) {
    return { reason: "missing", status: "stopped" };
  }

  const content = readBlueprintContent(blueprint);

  const schedule = getNextExamCheck({
    dates: {
      examDate: blueprint.examDate,
      registrationEndsAt: blueprint.registrationEndsAt,
      registrationStartsAt: getRegistrationStart(content.edition.dates),
    },
    now,
  });

  const learners = await countActiveExamGoals(blueprint.id);
  const reason = getExamStopReason({ learners, stop: schedule.stop, url: blueprint.source?.url });

  if (reason || !blueprint.source || !schedule.nextCheckAt) {
    await prisma.examBlueprint.update({ data: { nextCheckAt: null }, where: { id: blueprint.id } });
    return { reason: reason ?? "noUrl", status: "stopped" };
  }

  const refresh = await refreshSafely(blueprint.source.id);
  const sourceHash = refresh?.source.contentHash ?? blueprint.source.contentHash;

  const nextCheckAt = getNextCheckAfterRefresh({
    now,
    refreshed: Boolean(refresh),
    scheduled: schedule.nextCheckAt,
  });

  await prisma.examBlueprint.update({ data: { nextCheckAt }, where: { id: blueprint.id } });

  const isBehind = sourceHash !== content.edition.sourceHash;

  return {
    blueprintUpdate: isBehind
      ? { examBlueprintId: blueprint.id, sourceId: blueprint.source.id }
      : null,
    nextCheckAt: nextCheckAt.toISOString(),
    sourceChange: null,
    status: "scheduled",
  };
}

function toSourceChange({
  language,
  refresh,
  title,
}: {
  language: string;
  refresh: Awaited<ReturnType<typeof refreshSafely>>;
  title: string;
}): SourceChange | null {
  if (refresh?.status !== "changed") {
    return null;
  }

  return {
    change: refresh.change,
    contentHash: refresh.source.contentHash,
    language,
    previousHash: refresh.previousHash,
    sourceId: refresh.source.id,
    title,
  };
}

async function checkSource({
  now,
  sourceId,
}: {
  now: Date;
  sourceId: string;
}): Promise<FreshnessCheck> {
  const [source, learners] = await Promise.all([
    prisma.source.findUnique({ omit: { extractedText: true }, where: { id: sourceId } }),
    countActiveSourceGoals(sourceId),
  ]);

  if (!source) {
    return { reason: "missing", status: "stopped" };
  }

  const reason = getSourceStopReason({ learners, url: source.url });

  if (reason) {
    await prisma.source.update({ data: { nextCheckAt: null }, where: { id: source.id } });
    return { reason, status: "stopped" };
  }

  const refresh = await refreshSafely(source.id);

  const nextCheckAt = getNextCheckAfterRefresh({
    now,
    refreshed: Boolean(refresh),
    scheduled: getNextSourceCheck({
      now,
      validUntil: refresh?.source.validUntil ?? source.validUntil,
    }),
  });

  await prisma.source.update({ data: { nextCheckAt }, where: { id: source.id } });

  return {
    blueprintUpdate: null,
    nextCheckAt: nextCheckAt.toISOString(),
    sourceChange: toSourceChange({ language: source.language, refresh, title: source.title }),
    status: "scheduled",
  };
}

/**
 * One freshness check: stop when the exam has passed, nobody studies it or
 * there's nothing to fetch; otherwise fetch the source again, compare hashes
 * and schedule the next check. It never calls a model: the result says
 * whether the blueprint is behind its notice or a source changed, and the
 * workflow runs a model only then.
 */
export function checkFreshness({
  now = new Date(),
  target,
}: {
  now?: Date;
  target: FreshnessTarget;
}): Promise<FreshnessCheck> {
  return target.kind === "exam"
    ? checkExam({ examBlueprintId: target.examBlueprintId, now })
    : checkSource({ now, sourceId: target.sourceId });
}
