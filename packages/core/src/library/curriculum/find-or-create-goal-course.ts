import "server-only";
import { type Course, type CourseFormat, type TransactionClient, prisma } from "@zoonk/db";
import { lockCourseHome } from "@zoonk/db/course-home";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { normalizeString, pickAvailableSlug } from "@zoonk/utils/string";
import { getCourseSlugForTitle } from "../../courses/course-slug";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { findCourseByTitle } from "../identity/kinds/course-identity";
import { resolveLibraryIdentity } from "../identity/resolve-library-identity";
import { type CurriculumAnalytics, type CurriculumScope } from "./curriculum-scope";

type CourseScope = Pick<CurriculumScope, "language" | "ownerId" | "targetLanguage"> &
  Partial<Pick<CurriculumScope, "generalGoal">>;

async function getCourseHome(ownerId: string | null) {
  if (ownerId) {
    return { homeId: ownerId, organizationId: null };
  }

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { slug: AI_ORG_SLUG },
  });

  return { homeId: organization.id, organizationId: organization.id };
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
    await lockCourseHome({ homeId, transaction: tx });

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

/** Internal workflow bridge: the owner must come from the goal the public boundary authorized. */
export async function findOrCreateGoalCourse({
  analytics,
  format,
  provenance,
  scope,
  title,
}: {
  analytics?: CurriculumAnalytics;
  format: CourseFormat;
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
