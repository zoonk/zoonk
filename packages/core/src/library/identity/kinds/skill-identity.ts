import "server-only";
import { type LibraryIdentityCandidate } from "@zoonk/ai/tasks/v2/identity/subject";
import { prisma, sql } from "@zoonk/db";
import { buildSkillIdentityKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { findSurvivingSkill } from "../../skills/_utils/find-surviving-skill";
import { isInRequestScope } from "../_utils/exact-match-scope";
import { type IdentityKindSearch, type SkillIdentityRequest } from "../_utils/identity-requests";
import { SKILL_DOCUMENT } from "../_utils/search-documents";
import { type TextSearch, findRankedIds, orderByIds } from "../_utils/text-search-sql";

/**
 * An exact match on a merged duplicate returns the skill it was merged into.
 * Keys are scoped per owner already; the row check also keeps a private skill
 * away from every other learner, even under a wrongly scoped key.
 */
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

/**
 * Surviving public skills in the same language and target language whose words
 * match. Level isn't filtered: a skill is the same at every level.
 */
async function searchSkillCandidates({
  request,
  search,
}: {
  request: SkillIdentityRequest;
  search: TextSearch;
}): Promise<LibraryIdentityCandidate[]> {
  const ids = await findRankedIds({
    document: SKILL_DOCUMENT,
    filters: sql`s.language = ${request.language}
      AND s.target_language IS NOT DISTINCT FROM ${request.targetLanguage}
      AND s.merged_into_id IS NULL
      AND s.visibility = 'public'`,
    search,
  });

  const skills = await prisma.skill.findMany({ where: { id: { in: ids } } });

  return orderByIds(ids, skills).map((skill) => ({
    id: skill.id,
    item: {
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
        description: request.description,
        targetLanguage: request.targetLanguage,
        title: request.name,
      },
      kind: "skill",
      language: request.language,
    },
    baseTerms: [request.name],
    findExact: () => findExactSkill({ identityKey, request }),
    identityKey,
    searchCandidates: (search) => searchSkillCandidates({ request, search }),
  };
}
