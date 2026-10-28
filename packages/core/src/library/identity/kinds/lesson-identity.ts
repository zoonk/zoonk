import "server-only";
import {
  type LibraryIdentityCandidate,
  type LibraryIdentitySubject,
} from "@zoonk/ai/tasks/v2/identity/subject";
import { type Sql, prisma, sql } from "@zoonk/db";
import { buildLessonIdentityKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { QUICK_LESSON_KEY_SQL_PATTERN } from "../../quick-lessons/quick-lesson-identity";
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

const LESSON_WITH_SKILLS_DOCUMENT = {
  language: LESSON_DOCUMENT.language,
  parts: sql`${LESSON_DOCUMENT.parts} || (
    SELECT string_agg(s.name, ' ') FROM lesson_skills ls JOIN skills s ON s.id = ls.skill_id
    WHERE ls.lesson_id = l.id)`,
};

function toEligibleLessonSql(request: LessonIdentityRequest): Sql {
  return sql`l.language = ${request.language}
    AND l.level = ${request.level}::"CourseLevel"
    AND l.visibility = 'public'
    AND l.target_language IS NOT DISTINCT FROM ${request.targetLanguage}
    AND l.identity_key !~ ${QUICK_LESSON_KEY_SQL_PATTERN}`;
}

function toLessonsHoldingSql({ eligible, query }: { eligible: Sql; query: Sql }): Sql {
  return sql`SELECT l.id FROM ${toIndexedMatchesSql({ document: LESSON_DOCUMENT, query })}
    WHERE ${eligible}`;
}

function toLessonsTeachingSql({
  eligible,
  language,
  query,
}: {
  eligible: Sql;
  language: string;
  query: Sql;
}): Sql {
  // `OFFSET 0` keeps PostgreSQL from merging steps and rescanning eligibility indexes for each lesson.
  return sql`SELECT l.id FROM ${toIndexedMatchesSql({ document: SKILL_DOCUMENT, query })}
    CROSS JOIN LATERAL (
      SELECT ls.lesson_id FROM lesson_skills ls WHERE ls.skill_id = s.id OFFSET 0
    ) ls
    CROSS JOIN LATERAL (
      SELECT l.id FROM (
        SELECT * FROM library_lessons l WHERE l.id = ls.lesson_id OFFSET 0
      ) l WHERE ${eligible} OFFSET 0
    ) l
    WHERE s.language = ${language}`;
}

function toWordQueries(term: SearchTerm): string[] {
  return term.map((spellings) => toWordTsQuery(spellings));
}

function listSplitTermWords(terms: readonly SearchTerm[]): string[] {
  const searched = new Set(
    terms.filter((term) => term.length === 1).flatMap((term) => toWordQueries(term)),
  );

  const words = terms.filter((term) => term.length > 1).flatMap((term) => toWordQueries(term));

  return [...new Set(words)].filter((word) => !searched.has(word));
}

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

type LessonIdentitySubjectInput = Omit<LessonIdentityRequest, "kind" | "ownerId" | "skills"> & {
  skills: readonly { name: string }[];
};

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
