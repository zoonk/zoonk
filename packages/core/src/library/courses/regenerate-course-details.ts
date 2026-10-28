import "server-only";
import { getCourseDetailsPromptVersion } from "@zoonk/ai/tasks/v2/courses/details";
import { type Course, DbNull, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { COURSE_LIST_CACHE_TAG, getCourseCacheTag } from "../../cache/tags";
import { getAdminAccess } from "../../users/get-admin-access";

const BATCH_SIZE = 25;
const COST_PER_COURSE = 0.0006;

const RECOVERY_DELAY_MS = 60 * 60 * 1000;
const HAND_WRITTEN_MODEL = "zoonk/hand-written";

type ActiveCourseIds = () => Promise<ReadonlySet<string>>;

function publicCopyWhere() {
  return {
    OR: [{ detailsModel: null }, { detailsModel: { not: HAND_WRITTEN_MODEL } }],
    courseChapters: { some: {} },
    visibility: "public" as const,
  };
}

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
type ClaimedCourse = { course: Course; claimedAt: Date };

async function claimCourse({
  course,
  inFlight,
  now,
}: {
  course: Course;
  inFlight: ReadonlySet<string>;
  now: Date;
}): Promise<ClaimedCourse[]> {
  const claimedAt = new Date();

  const claim = await prisma.course.updateMany({
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

async function claimCourses({
  getInFlightCourseIds,
  promptVersion,
}: {
  getInFlightCourseIds: ActiveCourseIds;
  promptVersion?: string | null;
}): Promise<ClaimedCourse[]> {
  const inFlight = await getInFlightCourseIds();
  const now = new Date();

  const courses = await prisma.course.findMany({
    orderBy: [{ detailsGeneratedAt: { nulls: "first", sort: "asc" } }, { id: "asc" }],
    take: BATCH_SIZE,
    where: staleDetailsWhere({ inFlight, now, promptVersion }),
  });

  const claims = await Promise.all(courses.map((course) => claimCourse({ course, inFlight, now })));
  return claims.flat();
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

export async function regenerateCourseDetails({
  getInFlightCourseIds,
  promptVersion,
  startCourseDetails,
}: {
  promptVersion?: string | null;
  startCourseDetails: Dispatch;
  getInFlightCourseIds: ActiveCourseIds;
}): Promise<
  | { courseIds: string[]; failed: number; status: "started" }
  | { status: "forbidden" | "unauthorized" }
> {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  const claims = await claimCourses({ getInFlightCourseIds, promptVersion });

  const results = await Promise.all(
    claims.map((claim) => dispatchCourse({ claim, startCourseDetails })),
  );

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
