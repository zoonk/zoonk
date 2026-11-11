import "server-only";
import {
  LIBRARY_IDENTITY_MIN_PROBABILITY,
  decideLibraryIdentity,
} from "@zoonk/ai/tasks/identity/decision";
import {
  type LibraryIdentityCandidate,
  type LibraryIdentitySubject,
} from "@zoonk/ai/tasks/identity/subject";
import { prisma, sql } from "@zoonk/db";
import { SOURCE_DOCUMENT } from "../identity/_utils/search-documents";
import { findRankedIds, orderByIds, toTextSearch } from "../identity/_utils/text-search-sql";
import { READABLE_SOURCE_FILTER } from "./_utils/readable-sources";
import { type SourceTopic } from "./source-contract";

export type ResearchSourceTopic = Exclude<SourceTopic, "exam" | "product" | "software">;

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
  syllabus: "A course syllabus or official curriculum that lists this subject's topics",
};

function describeWantedDocument({ country, topic }: StoredSourcesRequest): string {
  const place = country === ANY_COUNTRY ? "" : ` (country: ${country})`;
  return `${WANTED_DOCUMENTS[topic]}${place}.`;
}

/** Enough for the judge to tell a law's text from an index page, an older edition or another law. */
const OPENING_CHARACTERS = 1500;

/** `length` is null for a document that stored no text, such as a PDF models read as a file. */
export type ResearchSourceCandidate = LibraryIdentityCandidate & {
  length: number | null;
  url: string | null;
};

type CandidateRow = {
  id: string;
  length: number | null;
  opening: string | null;
  publisher: string | null;
  title: string;
  url: string | null;
};

function toOpening(text: string | null): string | null {
  return text?.replaceAll(/\s+/gu, " ").trim() || null;
}

/** Internal workflow bridge: the sources are public research documents. */
export async function loadResearchSourceCandidates(
  ids: readonly string[],
): Promise<ResearchSourceCandidate[]> {
  if (ids.length === 0) {
    return [];
  }

  const rows = await prisma.$queryRaw<CandidateRow[]>`
    SELECT s.id, s.title, s.publisher, s.url,
      char_length(s.extracted_text)::int AS length,
      left(s.extracted_text, ${OPENING_CHARACTERS}) AS opening
    FROM sources s
    WHERE s.id = ANY(${[...ids]}::uuid[])`;

  return orderByIds(ids, rows).map((row) => ({
    id: row.id,
    item: {
      opening: toOpening(row.opening),
      publisher: row.publisher,
      title: row.title,
      url: row.url,
    },
    length: row.length,
    url: row.url,
  }));
}

/** Internal workflow bridge: the public boundary must already have authorized the goal. */
export async function searchStoredResearchSources(
  request: StoredSourcesRequest,
): Promise<string[]> {
  const search = toTextSearch({
    language: request.language,
    terms: [request.name, ...request.searchTerms],
  });

  if (!search) {
    return [];
  }

  return findRankedIds({
    document: SOURCE_DOCUMENT,
    filters: sql`s.language = ${search.language}
      AND s.visibility = 'public'
      AND s.kind = 'official'
      AND s.structure->>'topic' = ${request.topic}
      AND s.valid_until > ${new Date()}
      AND ${READABLE_SOURCE_FILTER}`,
    search,
  });
}

/** The candidates the judge reuses for the request, in their order; no call for none. */
export async function judgeResearchSources({
  candidates,
  request,
}: {
  candidates: readonly LibraryIdentityCandidate[];
  request: StoredSourcesRequest;
}): Promise<string[]> {
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

  const { verdicts } = await decideLibraryIdentity({
    candidates: candidates.map(({ id, item }) => ({ id, item })),
    subject,
  });

  const reusable = new Set(
    verdicts
      .filter((verdict) => verdict.probability >= LIBRARY_IDENTITY_MIN_PROBABILITY)
      .map((verdict) => verdict.id),
  );

  return candidates.filter((candidate) => reusable.has(candidate.id)).map(({ id }) => id);
}

/** Internal workflow bridge: the public boundary must already have authorized the goal. */
export async function findStoredResearchSources(request: StoredSourcesRequest): Promise<string[]> {
  const candidates = await loadResearchSourceCandidates(await searchStoredResearchSources(request));
  const reusable = await judgeResearchSources({ candidates, request });

  return reusable.slice(0, MAX_REUSED_SOURCES);
}
