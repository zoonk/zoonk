import "server-only";
import {
  LIBRARY_IDENTITY_MIN_PROBABILITY,
  decideLibraryIdentity,
} from "@zoonk/ai/tasks/v2/identity/decision";
import {
  type LibraryIdentityCandidate,
  type LibraryIdentitySubject,
} from "@zoonk/ai/tasks/v2/identity/subject";
import { prisma, sql } from "@zoonk/db";
import { SOURCE_DOCUMENT } from "../identity/_utils/search-documents";
import {
  type TextSearch,
  findRankedIds,
  orderByIds,
  toTextSearch,
} from "../identity/_utils/text-search-sql";
import { READABLE_SOURCE_FILTER } from "./_utils/readable-sources";
import { type SourceTopic } from "./source-contract";

export type ResearchSourceTopic = Exclude<SourceTopic, "exam">;

export type StoredSourcesRequest = {
  /** ISO 3166-1 alpha-2, or "ZZ" when any country fits (a product, most syllabi). */
  country: string;
  language: string;
  name: string;
  publisher: string | null;
  searchTerms: readonly string[];
  topic: ResearchSourceTopic;
};

const ANY_COUNTRY = "ZZ";

const MAX_REUSED_SOURCES = 4;

const WANTED_DOCUMENTS: Record<ResearchSourceTopic, string> = {
  regulation: "The current official text of this law or regulation",
  software: "The current official documentation or release notes of this product",
  syllabus: "A course syllabus or official curriculum that lists this subject's topics",
};

function describeWantedDocument({ country, topic }: StoredSourcesRequest): string {
  const place = country === ANY_COUNTRY ? "" : ` (country: ${country})`;
  return `${WANTED_DOCUMENTS[topic]}${place}.`;
}

async function searchStoredSources({
  search,
  topic,
}: {
  search: TextSearch;
  topic: ResearchSourceTopic;
}): Promise<LibraryIdentityCandidate[]> {
  const ids = await findRankedIds({
    document: SOURCE_DOCUMENT,
    filters: sql`s.language = ${search.language}
      AND s.visibility = 'public'
      AND s.kind = 'official'
      AND s.structure->>'topic' = ${topic}
      AND s.valid_until > ${new Date()}
      AND ${READABLE_SOURCE_FILTER}`,
    search,
  });

  const sources = await prisma.source.findMany({
    omit: { extractedText: true, structure: true },
    where: { id: { in: ids } },
  });

  return orderByIds(ids, sources).map((source) => ({
    id: source.id,
    item: { publisher: source.publisher, title: source.title, url: source.url },
  }));
}

async function findReusable({
  candidates,
  subject,
}: {
  candidates: LibraryIdentityCandidate[];
  subject: LibraryIdentitySubject;
}): Promise<LibraryIdentityCandidate[]> {
  const { verdicts } = await decideLibraryIdentity({ candidates, subject });

  const reusable = new Set(
    verdicts
      .filter((verdict) => verdict.probability >= LIBRARY_IDENTITY_MIN_PROBABILITY)
      .map((verdict) => verdict.id),
  );

  return candidates.filter((candidate) => reusable.has(candidate.id));
}

/** Internal workflow bridge: the public boundary must already have authorized the goal. */
export async function findStoredResearchSources(request: StoredSourcesRequest): Promise<string[]> {
  const search = toTextSearch({
    language: request.language,
    terms: [request.name, ...request.searchTerms],
  });

  if (!search) {
    return [];
  }

  const candidates = await searchStoredSources({ search, topic: request.topic });

  if (candidates.length === 0) {
    return [];
  }

  const subject: LibraryIdentitySubject = {
    goal: request.name,
    item: {
      description: describeWantedDocument(request),
      publisher: request.publisher,
      title: request.name,
    },
    kind: "researchSource",
    language: request.language,
  };

  const reusable = await findReusable({ candidates, subject });

  return reusable.slice(0, MAX_REUSED_SOURCES).map((candidate) => candidate.id);
}
