import "server-only";
import { type LibraryIdentityCandidate } from "@zoonk/ai/tasks/v2/identity/subject";
import { type Course, type TransactionClient, prisma, sql } from "@zoonk/db";
import { scopeIdentityKey } from "@zoonk/utils/identity-key";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { normalizeString } from "@zoonk/utils/string";
import { type CourseIdentityRequest, type IdentityKindSearch } from "../_utils/identity-requests";
import { COURSE_DOCUMENT } from "../_utils/search-documents";
import { type TextSearch, findRankedIds, orderByIds } from "../_utils/text-search-sql";

type CourseTitleRequest = Pick<
  CourseIdentityRequest,
  "language" | "ownerId" | "targetLanguage" | "title"
>;

/**
 * The course with this exact title for the request's owner: a shared course of the AI
 * organization, or the learner's own private course. The oldest wins, so every goal that names
 * the same course lands on the same row.
 */
export async function findCourseByTitle(
  request: CourseTitleRequest,
  client: TransactionClient = prisma,
): Promise<Course | null> {
  return client.course.findFirst({
    orderBy: { createdAt: "asc" },
    where: {
      ...(request.ownerId
        ? { userId: request.ownerId, visibility: "private" }
        : { organization: { slug: AI_ORG_SLUG }, visibility: "public" }),
      language: request.language,
      normalizedTitle: normalizeString(request.title),
      targetLanguage: request.targetLanguage,
    },
  });
}

async function findExactCourse(request: CourseIdentityRequest): Promise<string | null> {
  const course = await findCourseByTitle(request);
  return course?.id ?? null;
}

/** Shared courses in the same language and target language whose title or description match. */
async function searchCourseCandidates({
  request,
  search,
}: {
  request: CourseIdentityRequest;
  search: TextSearch;
}): Promise<LibraryIdentityCandidate[]> {
  const organization = await prisma.organization.findUnique({ where: { slug: AI_ORG_SLUG } });

  if (!organization) {
    return [];
  }

  // By the organization's id rather than a join on its slug: Postgres then knows it owns most
  // courses and reads the text-search index, instead of matching every shared course one by one.
  const ids = await findRankedIds({
    document: COURSE_DOCUMENT,
    filters: sql`c.organization_id = ${organization.id}::uuid
      AND c.language = ${request.language}
      AND c.visibility = 'public'
      AND c.target_language IS NOT DISTINCT FROM ${request.targetLanguage}`,
    search,
  });

  const courses = await prisma.course.findMany({ where: { id: { in: ids } } });

  return orderByIds(ids, courses).map((course) => ({
    id: course.id,
    item: {
      description: course.description,
      targetLanguage: course.targetLanguage,
      title: course.title,
    },
  }));
}

export function getCourseIdentitySearch(request: CourseIdentityRequest): IdentityKindSearch {
  const identityKey = scopeIdentityKey({
    key: normalizeString(request.title),
    ownerId: request.ownerId,
  });

  return {
    aiSubject: {
      goal: request.goal,
      item: { targetLanguage: request.targetLanguage, title: request.title },
      kind: "course",
      language: request.language,
    },
    baseTerms: [request.title],
    findExact: () => findExactCourse(request),
    identityKey,
    searchCandidates: (search) => searchCourseCandidates({ request, search }),
  };
}
