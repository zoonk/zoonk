import "server-only";
import { decideExamIdentity } from "@zoonk/ai/tasks/v2/research/exam-identity-decision";
import { type ExamBlueprint, prisma, sql } from "@zoonk/db";
import { normalizeIdentityText, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { EXAM_BLUEPRINT_DOCUMENT } from "../identity/_utils/search-documents";
import { findRankedIds, orderByIds, toTextSearch } from "../identity/_utils/text-search-sql";

/** What makes two exams the same: its name and, for public-service exams, the role. */
export type ExamIdentity = {
  board: string | null;
  country: string;
  language: string;
  name: string;
  /**
   * The learner whose private material the blueprint was read from, such as a
   * teacher's slides for a school exam. Their blueprint is private, lives in
   * their own key space and is deleted with them.
   */
  ownerId: string | null;
  role: string | null;
};

/**
 * One canonical key per exam, such as `enem` or `banco-do-brasil-escriturario`.
 * The board and the year aren't part of it: a board can change between
 * editions, and an edition is metadata on the same blueprint.
 */
export function buildExamIdentityKey({
  name,
  ownerId,
  role,
}: {
  name: string;
  ownerId: string | null;
  role: string | null;
}): string {
  return scopeIdentityKey({
    key: normalizeIdentityText([name, role].filter(Boolean).join(" ")),
    ownerId,
  });
}

export function findExamBlueprintByKey({
  identityKey,
  language,
}: {
  identityKey: string;
  language: string;
}): Promise<ExamBlueprint | null> {
  return prisma.examBlueprint.findUnique({
    where: { languageIdentity: { identityKey, language } },
  });
}

/**
 * Shared blueprints of the same language (and country, when it's known) whose name, board or
 * role match one of the model's search terms, best first. An exact key match is checked
 * before this; the search catches the same exam under another name, such as
 * "Exame Nacional do Ensino Médio" for ENEM.
 */
async function searchExamBlueprints({
  country,
  language,
  terms,
}: {
  /** Null for a learner who only named the exam: every country with exams in their language. */
  country: string | null;
  language: string;
  terms: string[];
}): Promise<ExamBlueprint[]> {
  const search = toTextSearch({ language, terms });

  if (!search) {
    return [];
  }

  const inCountry = country === null ? sql`TRUE` : sql`e.country = ${country}`;

  const ids = await findRankedIds({
    document: EXAM_BLUEPRINT_DOCUMENT,
    filters: sql`e.language = ${language} AND ${inCountry} AND e.visibility = 'public'`,
    search,
  });

  const blueprints = await prisma.examBlueprint.findMany({ where: { id: { in: ids } } });

  return orderByIds(ids, blueprints);
}

/** An exam as a request names it; the country is null when only the learner's words name it. */
export type ExamRequest = Omit<ExamIdentity, "country"> & { country: string | null };

/**
 * The stored blueprint of the exam a request names: its exact key first, then shared blueprints
 * whose names match, each confirmed by an evaluation model, so "ENEM" and "Exame Nacional do Ensino
 * Médio", or a role written two ways, find one blueprint. Research and onboarding both read exams
 * through it, so the dates a learner confirms come from the notice research keeps. A request
 * without a country is compared in the country of its best match.
 */
export async function findSameExam({
  request,
  searchTerms,
}: {
  request: ExamRequest;
  searchTerms: string[];
}): Promise<ExamBlueprint | null> {
  const identityKey = buildExamIdentityKey(request);
  const exact = await findExamBlueprintByKey({ identityKey, language: request.language });

  // Private blueprints only match their owner's exact key.
  if (exact || request.ownerId) {
    return exact;
  }

  const candidates = await searchExamBlueprints({
    country: request.country,
    language: request.language,
    terms: [request.name, ...searchTerms],
  });

  const [best] = candidates;

  if (!best) {
    return null;
  }

  const match = await decideExamIdentity({
    candidates,
    request: { ...request, country: request.country ?? best.country },
  });

  return candidates.find((candidate) => candidate.id === match?.id) ?? null;
}

/**
 * The identity of a stored shared blueprint, so a freshness check can read its
 * new notice under the same key. Blueprints from private material have none:
 * they come from uploads, which never change.
 */
export async function getSharedExamIdentity(examBlueprintId: string): Promise<ExamIdentity | null> {
  const blueprint = await prisma.examBlueprint.findUnique({
    select: {
      board: true,
      country: true,
      language: true,
      name: true,
      role: true,
      visibility: true,
    },
    where: { id: examBlueprintId },
  });

  if (!blueprint || blueprint.visibility !== "public") {
    return null;
  }

  return {
    board: blueprint.board,
    country: blueprint.country,
    language: blueprint.language,
    name: blueprint.name,
    ownerId: null,
    role: blueprint.role,
  };
}
