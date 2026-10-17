import "server-only";
import { getCourseDetailsPromptVersion } from "@zoonk/ai/tasks/v2/courses/details";
import { type Course, DbNull, type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { COURSE_LIST_CACHE_TAG, getCourseCacheTag } from "../../cache/tags";
import { getAdminAccess } from "../../users/get-admin-access";

const BATCH_SIZE = 25;
/** About $0.30/day, shared with today's completed and in-flight details generation. */
const MAX_DAILY_COURSE_COPY_REWRITES = 500;
const COST_PER_COURSE = 0.0006;

const RECOVERY_DELAY_MS = 60 * 60 * 1000;
const HAND_WRITTEN_MODEL = "zoonk/hand-written";

type ActiveCourseIds = () => Promise<ReadonlySet<string>>;

/** Only public outlined copy without an explicit manual provenance marker is owned here. */
function publicCopyWhere() {
  return {
    OR: [{ detailsModel: null }, { detailsModel: { not: HAND_WRITTEN_MODEL } }],
    courseChapters: { some: {} },
    visibility: "public" as const,
  };
}

/** Unknown provenance is legacy copy; empty copy is retryable after its dispatch grace period. */
function staleDetailsWhere({
  inFlight,
  now,
  promptVersion,
}: {
  inFlight: ReadonlySet<string>;
  now: Date;
  promptVersion?: string | null;
}) {
  return {
    AND: [
      publicCopyWhere(),
      {
        OR: [
          {
            AND: [
              {
                OR: [
                  { detailsPromptVersion: null },
                  { detailsPromptVersion: { not: getCourseDetailsPromptVersion() } },
                ],
              },
              { landingPage: { not: DbNull } },
            ],
          },
          {
            landingPage: { equals: DbNull },
            updatedAt: { lt: new Date(now.getTime() - RECOVERY_DELAY_MS) },
          },
        ],
      },
    ],
    ...(promptVersion !== undefined && { detailsPromptVersion: promptVersion }),
    id: { notIn: [...inFlight] },
  };
}

/** Reads only; the same legacy/stale/recovery selection used by both writing paths. */
export async function getCourseDetailsRegenerationPreview({
  getInFlightCourseIds,
  promptVersion,
}: {
  getInFlightCourseIds: ActiveCourseIds;
  promptVersion?: string | null;
}) {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  const inFlight = await getInFlightCourseIds();

  const matching = await prisma.course.count({
    where: staleDetailsWhere({ inFlight, now: new Date(), promptVersion }),
  });

  return {
    batchSize: BATCH_SIZE,
    estimatedCost: matching * COST_PER_COURSE,
    matching,
    status: "ready" as const,
  };
}

type Dispatch = (courseId: string) => Promise<unknown>;
type BatchResult = { courseIds: string[]; failed: number; status: "started" };
type ClaimedCourse = { course: Course; claimedAt: Date };

/** Today includes finished model writes and cleared copy still waiting for its workflow. */
function generatedTodayWhere(now: Date) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  return {
    AND: [
      publicCopyWhere(),
      {
        OR: [
          { detailsGeneratedAt: { gte: today } },
          { landingPage: { equals: DbNull }, updatedAt: { gte: today } },
        ],
      },
    ],
  };
}

async function claimCourse({
  course,
  tx,
  inFlight,
  now,
}: {
  course: Course;
  tx: TransactionClient;
  inFlight: ReadonlySet<string>;
  now: Date;
}): Promise<ClaimedCourse[]> {
  const claimedAt = new Date();

  const claim = await tx.course.updateMany({
    data: { landingPage: DbNull, updatedAt: claimedAt },
    where: {
      ...staleDetailsWhere({ inFlight, now }),
      detailsPromptVersion: course.detailsPromptVersion,
      id: course.id,
      updatedAt: course.updatedAt,
    },
  });

  return claim.count === 0 ? [] : [{ claimedAt, course }];
}

/**
 * All admin and system claims use the same transaction lock, so concurrent sweeps cannot each
 * reserve the remaining daily allowance. Fresh writes and in-flight clears conservatively count
 * against the sweep budget; the owner's explicit admin batches may exceed that automatic cap.
 */
async function claimCourses({
  dailyCap,
  getInFlightCourseIds,
  limit,
  promptVersion,
}: {
  getInFlightCourseIds: ActiveCourseIds;
  dailyCap?: boolean;
  limit: number;
  promptVersion?: string | null;
}): Promise<ClaimedCourse[]> {
  const inFlight = await getInFlightCourseIds();

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext('course-copy-regeneration'))`;
    const now = new Date();
    const spent = dailyCap ? await tx.course.count({ where: generatedTodayWhere(now) }) : 0;

    const take = dailyCap
      ? Math.max(0, Math.min(limit, MAX_DAILY_COURSE_COPY_REWRITES - spent))
      : limit;

    if (take === 0) {
      return [];
    }

    const courses = await tx.course.findMany({
      orderBy: [{ detailsGeneratedAt: { nulls: "first", sort: "asc" } }, { id: "asc" }],
      take,
      where: staleDetailsWhere({ inFlight, now, promptVersion }),
    });

    const claims = await Promise.all(
      courses.map((course) => claimCourse({ course, inFlight, now, tx })),
    );

    return claims.flat();
  });
}

async function dispatchCourse({
  claim,
  startCourseDetails,
}: {
  claim: ClaimedCourse;
  startCourseDetails: Dispatch;
}) {
  const { course, claimedAt } = claim;
  const { error } = await safeAsync(() => startCourseDetails(course.id));

  if (error) {
    await prisma.course.updateMany({
      data: { landingPage: course.landingPage ?? DbNull, updatedAt: course.updatedAt },
      where: { id: course.id, landingPage: { equals: DbNull }, updatedAt: claimedAt },
    });

    return { courseIds: [], failed: 1 };
  }

  return { courseIds: [course.id], failed: 0 };
}

async function runBatch({
  dailyCap,
  getInFlightCourseIds,
  limit,
  promptVersion,
  startCourseDetails,
}: {
  dailyCap?: boolean;
  limit: number;
  promptVersion?: string | null;
  startCourseDetails: Dispatch;
  getInFlightCourseIds: ActiveCourseIds;
}): Promise<BatchResult> {
  const claims = await claimCourses({ dailyCap, getInFlightCourseIds, limit, promptVersion });
  /** Keep queue requests bounded even when the daily reservation holds 500 courses. */
  const waves = Array.from({ length: Math.ceil(claims.length / BATCH_SIZE) }, (_, index) =>
    claims.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE),
  );

  const results: { courseIds: string[]; failed: number }[] = [];

  for (const wave of waves) {
    results.push(
      // oxlint-disable-next-line no-await-in-loop -- Waves bound simultaneous queue requests to 25.
      ...(await Promise.all(wave.map((claim) => dispatchCourse({ claim, startCourseDetails })))),
    );
  }

  revalidateCacheTags([
    COURSE_LIST_CACHE_TAG,
    ...claims.map(({ course }) => getCourseCacheTag(course.id)),
  ]);

  return {
    courseIds: results.flatMap((result) => result.courseIds),
    failed: results.reduce((sum, result) => sum + result.failed, 0),
    status: "started",
  };
}

/** The owner's explicit POST: 25 stale public courses, using the same claims as the sweep. */
export async function regenerateCourseDetails({
  getInFlightCourseIds,
  promptVersion,
  startCourseDetails,
}: {
  promptVersion?: string | null;
  startCourseDetails: Dispatch;
  getInFlightCourseIds: ActiveCourseIds;
}): Promise<BatchResult | { status: "forbidden" | "unauthorized" }> {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  return runBatch({ getInFlightCourseIds, limit: BATCH_SIZE, promptVersion, startCourseDetails });
}

/** Workflow bridge for the secret-protected daily sweep, not an app authorization boundary. */
export async function sweepCourseDetails({
  getInFlightCourseIds,
  promptVersion,
  startCourseDetails,
}: {
  promptVersion?: string | null;
  startCourseDetails: Dispatch;
  getInFlightCourseIds: ActiveCourseIds;
}): Promise<BatchResult> {
  return runBatch({
    dailyCap: true,
    getInFlightCourseIds,
    limit: MAX_DAILY_COURSE_COPY_REWRITES,
    promptVersion,
    startCourseDetails,
  });
}
