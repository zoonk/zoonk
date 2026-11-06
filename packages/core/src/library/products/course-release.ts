import "server-only";
import { prisma } from "@zoonk/db";
import { refreshWebSource } from "../sources/web-sources";
import { pickCurrentRelease } from "./current-release";

type DatedRelease = { id: string; releasedAt: Date | null };

function isNewer(first: DatedRelease, second: DatedRelease): boolean {
  const byDate = (first.releasedAt?.getTime() ?? 0) - (second.releasedAt?.getTime() ?? 0);
  return byDate === 0 ? first.id > second.id : byDate > 0;
}

/**
 * The release a course teaching `fromId` moves to next: the oldest one out after it, so each
 * release's notes are compared in turn, or null when the course already teaches the current one.
 */
function pickNextRelease<TRelease extends DatedRelease>({
  fromId,
  now,
  releases,
}: {
  fromId: string | null;
  now: Date;
  releases: readonly TRelease[];
}): TRelease | null {
  const current = pickCurrentRelease({ now, releases });
  const from = releases.find((release) => release.id === fromId);

  if (!current || current.id === fromId) {
    return null;
  }

  if (!from?.releasedAt) {
    return current;
  }

  if (isNewer(from, current)) {
    return null;
  }

  return releases
    .filter((release) => release.releasedAt && release.releasedAt <= now && isNewer(release, from))
    .reduce((oldest, release) => (isNewer(oldest, release) ? release : oldest), current);
}

/** Active goals whose plan studies the course: as their own course, or a graph skill mapped to it. */
export function courseFollowersFilter(courseId: string) {
  return {
    OR: [
      { primaryCourseId: courseId },
      { plan: { graph: { array_contains: [{ courseIds: [courseId] }], path: ["skills"] } } },
    ],
    status: "active" as const,
  };
}

async function hasFollower(courseId: string): Promise<boolean> {
  const goal = await prisma.goal.findFirst({
    select: { id: true },
    where: courseFollowersFilter(courseId),
  });

  return goal !== null;
}

function loadMainCourses(where: { id?: string; productId?: string }) {
  return prisma.course.findMany({
    select: {
      id: true,
      isPinned: true,
      product: {
        select: {
          docsUrl: true,
          id: true,
          releases: { select: { id: true, releasedAt: true, sourceId: true } },
          releasesSourceId: true,
        },
      },
      productReleaseId: true,
    },
    where: { isPinned: false, productId: { not: null }, userId: null, ...where },
  });
}

type MainCourse = Awaited<ReturnType<typeof loadMainCourses>>[number];

function findNextRelease({ course, now }: { course: MainCourse; now: Date }) {
  return course.product
    ? pickNextRelease({ fromId: course.productReleaseId, now, releases: course.product.releases })
    : null;
}

/**
 * Internal workflow bridge for the release check and the daily sweep: the product's main courses
 * that don't teach its current release yet and that a learner follows.
 */
export async function listCoursesBehind({
  now = new Date(),
  productId,
}: { now?: Date; productId?: string } = {}): Promise<string[]> {
  const courses = await loadMainCourses(productId ? { productId } : {});
  const behind = courses.filter((course) => findNextRelease({ course, now }));

  const followed = await Promise.all(
    behind.map(async (course) => ((await hasFollower(course.id)) ? [course.id] : [])),
  );

  return followed.flat();
}

async function hasOpenFlags(courseId: string): Promise<boolean> {
  const flag = await prisma.contentReviewFlag.findFirst({
    select: { id: true },
    where: { lesson: { homeChapter: { homeCourseId: courseId } }, status: "open" },
  });

  return flag !== null;
}

async function findDocsSource(product: NonNullable<MainCourse["product"]>) {
  if (!product.docsUrl) {
    return null;
  }

  const source = await prisma.source.findFirst({
    select: { id: true },
    where: { productId: product.id, url: product.docsUrl },
  });

  return source?.id ?? null;
}

export type CourseReleaseState =
  | { status: "current" | "notMain" | "unfollowed" | "rewriting" }
  | {
      fromReleaseId: string | null;
      pageSourceIds: string[];
      status: "behind";
      toReleaseId: string;
    };

/**
 * Internal workflow bridge. A main course moves one release at a time, and only once the lessons
 * its last move flagged are rewritten, so a rewrite for one release never resolves the next one's flag.
 */
export async function loadCourseRelease({
  courseId,
  now = new Date(),
}: {
  courseId: string;
  now?: Date;
}): Promise<CourseReleaseState> {
  const [course] = await loadMainCourses({ id: courseId });
  const next = course ? findNextRelease({ course, now }) : null;

  if (!course?.product) {
    return { status: "notMain" };
  }

  if (!next) {
    return { status: "current" };
  }

  if (!(await hasFollower(course.id))) {
    return { status: "unfollowed" };
  }

  if (await hasOpenFlags(course.id)) {
    return { status: "rewriting" };
  }

  const pageId = next.sourceId ?? course.product.releasesSourceId;
  const docsId = await findDocsSource(course.product);

  return {
    fromReleaseId: course.productReleaseId,
    pageSourceIds: [...new Set([pageId, docsId].filter((id) => id !== null))],
    status: "behind",
    toReleaseId: next.id,
  };
}

/** The stored text stays good when a page doesn't answer, so a failed fetch doesn't stop the update. */
export async function refreshReleasePages(sourceIds: readonly string[]): Promise<void> {
  await Promise.allSettled(sourceIds.map((sourceId) => refreshWebSource(sourceId)));
}
