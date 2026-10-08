import "server-only";
import {
  type LibraryIdentityCandidate,
  type LibraryIdentitySubject,
} from "@zoonk/ai/tasks/v2/identity/subject";
import { type Sql, prisma, sql } from "@zoonk/db";
import { buildLessonIdentityKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { listChaptersCourses } from "../_utils/candidate-courses";
import { isInRequestScope } from "../_utils/exact-match-scope";
import { type IdentityKindSearch, type LessonIdentityRequest } from "../_utils/identity-requests";
import { LESSON_DOCUMENT, SKILL_DOCUMENT } from "../_utils/search-documents";
import {
  MAX_IDENTITY_CANDIDATES,
  MAX_MATCHES_PER_TERM,
  type TextSearch,
  toIndexedMatchesSql,
  toSearchVector,
  toTermMatchesSql,
  toTermQueries,
  toVectorSearchSql,
} from "../_utils/text-search-sql";
import { type SearchTerm, toWordTsQuery } from "../text-search-query";

async function findExactLesson({
  identityKey,
  request,
}: {
  identityKey: string;
  request: LessonIdentityRequest;
}): Promise<string | null> {
  const lesson = await prisma.lesson.findUnique({
    select: { id: true, ownerId: true, visibility: true },
    where: { languageIdentity: { identityKey, language: request.language } },
  });

  return lesson && isInRequestScope({ ownerId: request.ownerId, row: lesson }) ? lesson.id : null;
}

/** A lesson's search document: its own words and the names of the skills it teaches. */
const LESSON_WITH_SKILLS_DOCUMENT = {
  language: LESSON_DOCUMENT.language,
  parts: sql`${LESSON_DOCUMENT.parts} || (
    SELECT string_agg(s.name, ' ') FROM lesson_skills ls JOIN skills s ON s.id = ls.skill_id
    WHERE ls.lesson_id = l.id)`,
};

/** Public lessons in the request's language, level and target language. */
function toEligibleLessonSql(request: LessonIdentityRequest): Sql {
  return sql`l.language = ${request.language}
    AND l.level = ${request.level}::"CourseLevel"
    AND l.visibility = 'public'
    AND l.target_language IS NOT DISTINCT FROM ${request.targetLanguage}`;
}

/** Eligible lessons whose own words match the query. */
function toLessonsHoldingSql({ eligible, query }: { eligible: Sql; query: Sql }): Sql {
  return sql`SELECT l.id FROM ${toIndexedMatchesSql({ document: LESSON_DOCUMENT, query })}
    WHERE ${eligible}`;
}

/** Eligible lessons teaching a skill whose words match the query. A lesson's skills share its language. */
function toLessonsTeachingSql({
  eligible,
  language,
  query,
}: {
  eligible: Sql;
  language: string;
  query: Sql;
}): Sql {
  return sql`SELECT l.id FROM ${toIndexedMatchesSql({ document: SKILL_DOCUMENT, query })}
    JOIN lesson_skills ls ON ls.skill_id = s.id
    JOIN library_lessons l ON l.id = ls.lesson_id
    WHERE s.language = ${language} AND ${eligible}`;
}

function toWordQueries(term: SearchTerm): string[] {
  return term.map((spellings) => toWordTsQuery(spellings));
}

/**
 * The words of multi-word terms, whose skill matches find lessons holding a term partly in their
 * own words and partly in a skill's name. A word that's a term of its own is already searched.
 */
function listSplitTermWords(terms: readonly SearchTerm[]): string[] {
  const searched = new Set(
    terms.filter((term) => term.length === 1).flatMap((term) => toWordQueries(term)),
  );

  const words = terms.filter((term) => term.length > 1).flatMap((term) => toWordQueries(term));

  return [...new Set(words)].filter((word) => !searched.has(word));
}

/**
 * The lessons ranked for a search, found through the indexes with the request's filters: each
 * term's matches in lessons' own words and in their skills, plus lessons whose skills hold a word
 * that fewer than `MAX_MATCHES_PER_TERM` eligible lessons teach, since a term may be split between
 * a lesson's words and its skills. A broad word's lessons are left out: they rarely hold the
 * rest of its term. Only these are matched on the whole document and ranked, so the work stays
 * bounded as the Library grows.
 */
async function findRankedLessonIds({
  request,
  search,
}: {
  request: LessonIdentityRequest;
  search: TextSearch;
}): Promise<string[]> {
  const eligible = toEligibleLessonSql(request);
  const termQueries = toTermQueries(search);

  const holding = toTermMatchesSql({
    language: search.language,
    queries: termQueries,
    select: (query) => toLessonsHoldingSql({ eligible, query }),
  });

  const teaching = toTermMatchesSql({
    language: search.language,
    queries: termQueries,
    select: (query) => toLessonsTeachingSql({ eligible, language: request.language, query }),
  });

  const teachingWord = toTermMatchesSql({
    language: search.language,
    queries: listSplitTermWords(search.terms),
    select: (query) => toLessonsTeachingSql({ eligible, language: request.language, query }),
  });

  const { matches, rank } = toVectorSearchSql({ search, vector: sql`document` });

  // Materialized so each lesson's document is computed once, for both the match and the rank.
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    WITH pool AS (
      SELECT id FROM (${holding}) holding
      UNION
      SELECT id FROM (${teaching}) teaching
      UNION
      SELECT id FROM (${teachingWord}) teaching_word WHERE matches < ${MAX_MATCHES_PER_TERM}
    ),
    documents AS MATERIALIZED (
      SELECT l.id, ${toSearchVector(LESSON_WITH_SKILLS_DOCUMENT)} AS document
      FROM library_lessons l
      WHERE l.id IN (SELECT id FROM pool)
    )
    SELECT id FROM documents
    WHERE ${matches}
    ORDER BY ${rank} DESC, id
    LIMIT ${MAX_IDENTITY_CANDIDATES}`;

  return rows.map((row) => row.id);
}

/**
 * The lessons a search found, with their skills and the courses placing them. They may come from
 * any course: the reuse decision judges from both sides' courses whether one can serve the other.
 */
export async function loadLessonCandidates(
  ids: readonly string[],
): Promise<LibraryIdentityCandidate[]> {
  const lessons = await prisma.lesson.findMany({
    include: {
      chapters: {
        orderBy: { createdAt: "asc" },
        select: {
          chapter: {
            select: {
              courses: {
                orderBy: { createdAt: "asc" },
                select: { course: { select: { title: true } } },
              },
              homeCourse: { select: { title: true } },
            },
          },
        },
      },
      skills: { include: { skill: { select: { name: true } } } },
    },
    omit: { spec: true, summary: true },
    where: { id: { in: [...ids] } },
  });

  return lessons.map((lesson) => ({
    id: lesson.id,
    item: {
      courses: listChaptersCourses(lesson),
      description: lesson.description,
      level: lesson.level,
      skills: lesson.skills.map((item) => item.skill.name),
      targetLanguage: lesson.targetLanguage,
      title: lesson.title,
    },
  }));
}

/** What a lesson request says about itself, known before its skills are resolved to Library ids. */
type LessonIdentitySubjectInput = Omit<LessonIdentityRequest, "kind" | "ownerId" | "skills"> & {
  skills: readonly { name: string }[];
};

/**
 * The lesson as search terms and the reuse decision read it: its skills by name, so a caller can
 * write its search terms while the skills are still being resolved.
 */
export function toLessonIdentitySubject(
  request: LessonIdentitySubjectInput,
): LibraryIdentitySubject {
  return {
    goal: request.goal,
    item: {
      courses: request.course ? [request.course.title] : [],
      description: request.description,
      level: request.level,
      skills: request.skills.map((skill) => skill.name),
      targetLanguage: request.targetLanguage,
      title: request.title,
    },
    kind: "lesson",
    language: request.language,
  };
}

export function getLessonIdentitySearch(request: LessonIdentityRequest): IdentityKindSearch {
  const skillNames = request.skills.map((skill) => skill.name);

  const identityKey = scopeIdentityKey({
    key: buildLessonIdentityKey({
      courseId: request.course?.id ?? null,
      level: request.level,
      skillIds: request.skills.map((skill) => skill.id),
      targetLanguage: request.targetLanguage,
      title: request.sharesSkills ? request.title : null,
    }),
    ownerId: request.ownerId,
  });

  return {
    aiSubject: toLessonIdentitySubject(request),
    baseTerms: [request.title, ...skillNames],
    findCandidateIds: (search) => findRankedLessonIds({ request, search }),
    findExact: () => findExactLesson({ identityKey, request }),
    identityKey,
  };
}
