import "server-only";
import { decideExamIdentity } from "@zoonk/ai/tasks/v2/research/exam-identity-decision";
import { type ExamBlueprint, prisma, sql } from "@zoonk/db";
import { EXAM_BLUEPRINT_DOCUMENT } from "../identity/_utils/search-documents";
import { findRankedIds, orderByIds, toTextSearch } from "../identity/_utils/text-search-sql";
import { type ExamIdentity, buildExamIdentityKey, findExamBlueprintByKey } from "./exam-identity";

async function searchExamBlueprints({
  country,
  language,
  terms,
}: {
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

export type ExamRequest = Omit<ExamIdentity, "country"> & { country: string | null };

export async function findSameExam({
  request,
  searchTerms,
}: {
  request: ExamRequest;
  searchTerms: string[];
}): Promise<ExamBlueprint | null> {
  const identityKey = buildExamIdentityKey(request);
  const exact = await findExamBlueprintByKey({ identityKey, language: request.language });

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
