import "server-only";
import {
  type ExamDescription,
  decideExamIdentity,
} from "@zoonk/ai/tasks/research/exam-identity-decision";
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

export type SameExamSearch =
  | { blueprint: ExamBlueprint | null; status: "settled" }
  | { candidates: ExamBlueprint[]; request: ExamDescription; status: "undecided" };

/** Finds the stored exam a request names without a model call, or the candidates to decide on. */
export async function searchSameExam({
  request,
  searchTerms,
}: {
  request: ExamRequest;
  searchTerms: string[];
}): Promise<SameExamSearch> {
  const identityKey = buildExamIdentityKey(request);
  const exact = await findExamBlueprintByKey({ identityKey, language: request.language });

  if (exact || request.ownerId) {
    return { blueprint: exact, status: "settled" };
  }

  const candidates = await searchExamBlueprints({
    country: request.country,
    language: request.language,
    terms: [request.name, ...searchTerms],
  });

  const [best] = candidates;

  if (!best) {
    return { blueprint: null, status: "settled" };
  }

  return {
    candidates,
    request: { ...request, country: request.country ?? best.country },
    status: "undecided",
  };
}

export async function findSameExam(input: {
  request: ExamRequest;
  searchTerms: string[];
}): Promise<ExamBlueprint | null> {
  const search = await searchSameExam(input);

  if (search.status === "settled") {
    return search.blueprint;
  }

  const { candidates, request } = search;
  const match = await decideExamIdentity({ candidates, request });

  return candidates.find((candidate) => candidate.id === match?.id) ?? null;
}
