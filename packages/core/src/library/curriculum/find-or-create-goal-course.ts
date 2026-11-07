import "server-only";
import { type Course, type CourseFormat, prisma } from "@zoonk/db";
import { lockCourseHome } from "@zoonk/db/course-home";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { normalizeString } from "@zoonk/utils/string";
import { getAvailableCourseSlug } from "../_utils/available-course-slug";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { findCourseByTitle, getCourseIdentitySearch } from "../identity/kinds/course-identity";
import { resolveLibraryIdentity } from "../identity/resolve-library-identity";
import { writeSearchTerms } from "../identity/write-search-terms";
import { type CurriculumAnalytics, type CurriculumScope } from "./curriculum-scope";

type CourseScope = Pick<CurriculumScope, "language" | "ownerId" | "targetLanguage"> &
  Partial<Pick<CurriculumScope, "generalGoal">>;

function toCourseRequest({ scope, title }: { scope: CourseScope; title: string }) {
  return {
    goal: scope.generalGoal,
    kind: "course" as const,
    language: scope.language,
    ownerId: scope.ownerId,
    targetLanguage: scope.targetLanguage,
    title,
  };
}

/** Search terms and the identity decision run in separate durable steps. */
export async function writeGoalCourseSearchTerms({
  analytics,
  scope,
  title,
}: {
  analytics?: CurriculumAnalytics;
  scope: CourseScope;
  title: string;
}): Promise<string[]> {
  const search = getCourseIdentitySearch(toCourseRequest({ scope, title }));

  if (scope.ownerId || (await search.findExact())) {
    return [];
  }

  const [terms = []] = await writeSearchTerms({ analytics, subjects: [search.aiSubject] });
  return terms;
}

async function getCourseHome(ownerId: string | null) {
  if (ownerId) {
    return { homeId: ownerId, organizationId: null };
  }

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { slug: AI_ORG_SLUG },
  });

  return { homeId: organization.id, organizationId: organization.id };
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
        slug: await getAvailableCourseSlug(tx, {
          home: scope.ownerId ? { userId: homeId } : { organizationId: homeId },
          language: scope.language,
          title,
        }),
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
  searchTerms,
  title,
}: {
  analytics?: CurriculumAnalytics;
  format: CourseFormat;
  provenance: LibraryProvenance;
  scope: CourseScope;
  searchTerms?: readonly string[];
  title: string;
}): Promise<{ course: Course; created: boolean }> {
  const resolution = await resolveLibraryIdentity({
    analytics,
    request: toCourseRequest({ scope, title }),
    searchTerms,
  });

  if (resolution.kind === "existing") {
    const course = await prisma.course.findUniqueOrThrow({ where: { id: resolution.id } });
    return { course, created: false };
  }

  return createCourse({ format, provenance, scope, title });
}
