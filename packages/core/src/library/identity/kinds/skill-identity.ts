import "server-only";
import { type LibraryIdentityCandidate } from "@zoonk/ai/tasks/v2/identity/subject";
import { prisma, sql } from "@zoonk/db";
import { buildSkillIdentityKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { findSurvivingSkill } from "../../skills/_utils/find-surviving-skill";
import { listChaptersCourses } from "../_utils/candidate-courses";
import { isInRequestScope } from "../_utils/exact-match-scope";
import { type IdentityKindSearch, type SkillIdentityRequest } from "../_utils/identity-requests";
import { SKILL_DOCUMENT } from "../_utils/search-documents";
import { type TextSearch, findRankedIds } from "../_utils/text-search-sql";

async function findExactSkill({
  identityKey,
  request,
}: {
  identityKey: string;
  request: SkillIdentityRequest;
}): Promise<string | null> {
  const skill = await prisma.skill.findUnique({
    select: { id: true },
    where: { languageIdentity: { identityKey, language: request.language } },
  });

  if (!skill) {
    return null;
  }

  const survivor = await findSurvivingSkill(skill.id);

  if (!survivor || !isInRequestScope({ ownerId: request.ownerId, row: survivor.skill })) {
    return null;
  }

  return survivor.skill.id;
}

async function findSkillCandidateIds({
  request,
  search,
}: {
  request: SkillIdentityRequest;
  search: TextSearch;
}): Promise<string[]> {
  return findRankedIds({
    document: SKILL_DOCUMENT,
    filters: sql`s.language = ${request.language}
      AND s.target_language IS NOT DISTINCT FROM ${request.targetLanguage}
      AND s.merged_into_id IS NULL
      AND s.visibility = 'public'`,
    search,
  });
}

export async function loadSkillCandidates(
  ids: readonly string[],
): Promise<LibraryIdentityCandidate[]> {
  const skills = await prisma.skill.findMany({
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
    },
    where: { id: { in: [...ids] } },
  });

  return skills.map((skill) => ({
    id: skill.id,
    item: {
      courses: listChaptersCourses(skill),
      description: skill.description,
      targetLanguage: skill.targetLanguage,
      title: skill.name,
    },
  }));
}

export function getSkillIdentitySearch(request: SkillIdentityRequest): IdentityKindSearch {
  const identityKey = scopeIdentityKey({
    key: buildSkillIdentityKey(request),
    ownerId: request.ownerId,
  });

  return {
    aiSubject: {
      goal: request.goal,
      item: {
        courses: request.course ? [request.course] : [],
        description: request.description,
        targetLanguage: request.targetLanguage,
        title: request.name,
      },
      kind: "skill",
      language: request.language,
    },
    baseTerms: [request.name],
    findCandidateIds: (search) => findSkillCandidateIds({ request, search }),
    findExact: () => findExactSkill({ identityKey, request }),
    identityKey,
  };
}
