import "server-only";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/v2/identity/decision";
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

/** Exams have their own lookup: the canonical blueprint, found by name and role. */
export type ResearchSourceTopic = Exclude<SourceTopic, "exam">;

/** What research wants to read, as its plan names it. */
export type StoredSourcesRequest = {
  /** ISO 3166-1 alpha-2, or "ZZ" when any country fits (a product, most syllabi). */
  country: string;
  /** The language of the documents research reads. */
  language: string;
  /** The law, product or subject, as the research plan names it. */
  name: string;
  /** The organizer the plan names, when it knows one. */
  publisher: string | null;
  /** The plan's phrases for the same topic, including the full name and the acronym. */
  searchTerms: readonly string[];
  topic: ResearchSourceTopic;
};

const ANY_COUNTRY = "ZZ";

/** Research stores at most this many documents per topic, so it reuses no more than that. */
const MAX_REUSED_SOURCES = 4;

/** The document research would fetch, which each stored candidate must be able to replace. */
const WANTED_DOCUMENTS: Record<ResearchSourceTopic, string> = {
  regulation: "The current official text of this law or regulation",
  software: "The current official documentation or release notes of this product",
  syllabus: "A course syllabus or official curriculum that lists this subject's topics",
};

function describeWantedDocument({ country, topic }: StoredSourcesRequest): string {
  const place = country === ANY_COUNTRY ? "" : ` (country: ${country})`;
  return `${WANTED_DOCUMENTS[topic]}${place}.`;
}

/**
 * Official public sources research stored for the same kind of topic that are still valid
 * (a law's text for 30 days, a product's docs for 90, a syllabus for a year) and readable (a page
 * without text would take a document's place), whose title, publisher or address match the plan's
 * name or search terms, best first.
 */
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

/**
 * Each candidate gets its own reuse decision, since research can reuse several documents (a law
 * and its regulation, syllabi from two universities), not only the best one.
 */
async function isReusable({
  candidate,
  subject,
}: {
  candidate: LibraryIdentityCandidate;
  subject: LibraryIdentitySubject;
}): Promise<boolean> {
  const { match } = await decideLibraryIdentity({ candidates: [candidate], subject });
  return match !== null;
}

/**
 * The sources another learner's research already stored for the same law, product or subject,
 * so this goal reuses them instead of searching the web and fetching them again. The Library
 * identity flow finds them: text search with the plan's own words over official sources that
 * are still valid, and the reuse decision on each candidate against the document research would
 * fetch. Empty when nothing stored fits, and research searches as usual.
 *
 * This is a workflow bridge: research runs for a goal the public boundary already checked.
 */
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

  const reusable = await Promise.all(
    candidates.map((candidate) => isReusable({ candidate, subject })),
  );

  return candidates
    .filter((_candidate, index) => reusable[index])
    .slice(0, MAX_REUSED_SOURCES)
    .map((candidate) => candidate.id);
}
