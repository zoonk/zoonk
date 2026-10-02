import "server-only";
import { type LibraryIdentityCandidate } from "@zoonk/ai/tasks/v2/identity/subject";
import { prisma, sql } from "@zoonk/db";
import { buildChapterIdentityKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { listChapterCourses } from "../_utils/candidate-courses";
import { isInRequestScope } from "../_utils/exact-match-scope";
import { type ChapterIdentityRequest, type IdentityKindSearch } from "../_utils/identity-requests";
import { CHAPTER_DOCUMENT } from "../_utils/search-documents";
import { type TextSearch, findRankedIds } from "../_utils/text-search-sql";

async function findExactChapter({
  identityKey,
  request,
}: {
  identityKey: string;
  request: ChapterIdentityRequest;
}): Promise<string | null> {
  const chapter = await prisma.chapter.findUnique({
    where: { languageIdentity: { identityKey, language: request.language } },
  });

  return chapter && isInRequestScope({ ownerId: request.ownerId, row: chapter })
    ? chapter.id
    : null;
}

/**
 * Public chapters in the same language, level and target language whose words match, from any
 * course: a course on the same subject under another name can share them, which the reuse
 * decision judges from both sides' courses.
 */
async function findChapterCandidateIds({
  request,
  search,
}: {
  request: ChapterIdentityRequest;
  search: TextSearch;
}): Promise<string[]> {
  return findRankedIds({
    document: CHAPTER_DOCUMENT,
    filters: sql`c.language = ${request.language}
      AND c.level = ${request.level}::"CourseLevel"
      AND c.visibility = 'public'
      AND c.target_language IS NOT DISTINCT FROM ${request.targetLanguage}`,
    search,
  });
}

export async function loadChapterCandidates(
  ids: readonly string[],
): Promise<LibraryIdentityCandidate[]> {
  const chapters = await prisma.chapter.findMany({
    include: {
      courses: { orderBy: { createdAt: "asc" }, select: { course: { select: { title: true } } } },
      homeCourse: { select: { title: true } },
    },
    where: { id: { in: [...ids] } },
  });

  return chapters.map((chapter) => ({
    id: chapter.id,
    item: {
      courses: listChapterCourses(chapter),
      description: chapter.description,
      level: chapter.level,
      objectives: chapter.objectives,
      targetLanguage: chapter.targetLanguage,
      title: chapter.title,
    },
  }));
}

export function getChapterIdentitySearch(request: ChapterIdentityRequest): IdentityKindSearch {
  const identityKey = scopeIdentityKey({
    key: buildChapterIdentityKey({ ...request, courseId: request.course.id }),
    ownerId: request.ownerId,
  });

  return {
    aiSubject: {
      goal: request.goal,
      item: {
        courses: [request.course.title],
        description: request.description,
        level: request.level,
        objectives: request.objectives,
        targetLanguage: request.targetLanguage,
        title: request.title,
      },
      kind: "chapter",
      language: request.language,
    },
    baseTerms: [request.title],
    findCandidateIds: (search) => findChapterCandidateIds({ request, search }),
    findExact: () => findExactChapter({ identityKey, request }),
    identityKey,
  };
}
