import "server-only";
import { type Course, type CourseFormat, type TransactionClient, prisma, sql } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { normalizeString } from "@zoonk/utils/string";
import { getCourseSlugForTitle } from "../../courses/course-slug";
import {
  type LibraryProvenance,
  pickAvailableSlug,
  toProvenanceData,
} from "../_utils/library-rows";
import { findCourseByTitle } from "../identity/kinds/course-identity";
import { resolveLibraryIdentity } from "../identity/resolve-library-identity";
import { type CurriculumAnalytics, type CurriculumScope } from "./curriculum-scope";

/** Namespaces the course-creation lock so it never collides with other advisory locks. */
const COURSE_LOCK_NAMESPACE = 51_882;

type CourseScope = Pick<CurriculumScope, "language" | "ownerId" | "targetLanguage"> &
  Partial<Pick<CurriculumScope, "generalGoal">>;

/**
 * Where a course lives, and where its slug has to be free: the AI organization for a shared
 * course, or the learner for their own.
 */
async function getCourseHome(ownerId: string | null) {
  if (ownerId) {
    return { homeId: ownerId, organizationId: null };
  }

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { slug: AI_ORG_SLUG },
  });

  return { homeId: organization.id, organizationId: organization.id };
}

/**
 * Serializes new courses in one home. A goal naming a course another goal is creating waits, then
 * finds that course instead of creating a second one under the next free slug, and two new
 * courses never pick the same slug. It's held for one lookup and one insert.
 */
async function lockCourseHome(tx: TransactionClient, homeId: string): Promise<void> {
  await tx.$queryRaw(
    sql`SELECT pg_advisory_xact_lock(${COURSE_LOCK_NAMESPACE}::int, hashtext(${homeId}))::text`,
  );
}

async function getAvailableSlug(
  tx: TransactionClient,
  { homeId, scope, title }: { homeId: string; scope: CourseScope; title: string },
): Promise<string> {
  const base = getCourseSlugForTitle({ language: scope.language, title }) || "course";

  const taken = await tx.course.findMany({
    select: { slug: true },
    where: {
      ...(scope.ownerId ? { userId: homeId } : { organizationId: homeId }),
      slug: { startsWith: base },
    },
  });

  return pickAvailableSlug({ base, taken: taken.map((course) => course.slug) });
}

/** A new course row, or the one another goal naming the same title created first. */
async function createCourse({
  format,
  provenance,
  scope,
  title,
}: {
  format: CourseFormat;
  provenance: LibraryProvenance;
  scope: CourseScope;
  title: string;
}): Promise<{ course: Course; created: boolean }> {
  const { homeId, organizationId } = await getCourseHome(scope.ownerId);

  return prisma.$transaction(async (tx) => {
    await lockCourseHome(tx, homeId);

    const existing = await findCourseByTitle({ ...scope, title }, tx);

    if (existing) {
      return { course: existing, created: false };
    }

    const course = await tx.course.create({
      data: {
        ...toProvenanceData(provenance),
        format,
        isPublished: false,
        language: scope.language,
        normalizedTitle: normalizeString(title),
        organizationId,
        outlineStatus: "pending",
        slug: await getAvailableSlug(tx, { homeId, scope, title }),
        targetLanguage: scope.targetLanguage,
        title,
        userId: scope.ownerId,
        visibility: scope.ownerId ? "private" : "public",
      },
    });

    return { course, created: true };
  });
}

/**
 * Finds the Library course a goal's skill graph names, or creates its row with an empty outline.
 * Shared courses belong to the AI organization and are found like every other Library item: the
 * same title first, then a course named differently for the same subject ("Newtonian mechanics"
 * for "Classical mechanics"), through search terms, text search and the reuse decision. A private
 * course belongs to its learner and is only ever matched for them, by title. Two goals naming the
 * same course at once end up with one row. The outline is written afterwards, under the course's
 * outline claim. A new course stores the provenance of the run that named it.
 *
 * This is a workflow bridge: the scope's owner comes from the goal the public boundary loaded.
 */
export async function findOrCreateGoalCourse({
  analytics,
  format,
  provenance,
  scope,
  title,
}: {
  analytics?: CurriculumAnalytics;
  format: CourseFormat;
  /** The run that named the course: the goal's skill graph or a quick explanation. */
  provenance: LibraryProvenance;
  scope: CourseScope;
  title: string;
}): Promise<{ course: Course; created: boolean }> {
  const resolution = await resolveLibraryIdentity({
    analytics,
    request: {
      goal: scope.generalGoal,
      kind: "course",
      language: scope.language,
      ownerId: scope.ownerId,
      targetLanguage: scope.targetLanguage,
      title,
    },
  });

  if (resolution.kind === "existing") {
    const course = await prisma.course.findUniqueOrThrow({ where: { id: resolution.id } });
    return { course, created: false };
  }

  return createCourse({ format, provenance, scope, title });
}
