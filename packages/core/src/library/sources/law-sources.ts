import "server-only";
import { prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { getSourceValidUntil } from "./freshness-schedule";
import { getMaxTextLength } from "./parse-document";
import {
  type ResearchSourceCandidate,
  type StoredSourcesRequest,
  judgeResearchSources,
  loadResearchSourceCandidates,
  searchStoredResearchSources,
} from "./stored-research-sources";

/** `country` is ISO 3166-1 alpha-2 and `language` the official text's. */
export type LawRequest = {
  country: string;
  language: string;
  name: string;
  officialDomains: readonly string[];
  searchTerms: readonly string[];
};

function toLawKey(law: LawRequest) {
  return {
    country: law.country,
    language: law.language,
    name: normalizeString(law.name)
      .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
      .trim(),
  };
}

/** Lessons naming the same law at once join one run. */
export function getLawLookupToken(law: LawRequest): string {
  const { country, language, name } = toLawKey(law);
  return `law-source:${country}:${language}:${name}`;
}

/** Null when the law hasn't been looked up in the last 30 days; `sourceId` is null when nothing was found. */
export async function readLawLookup(law: LawRequest): Promise<{ sourceId: string | null } | null> {
  const lookup = await prisma.lawLookup.findUnique({ where: { lawKey: toLawKey(law) } });

  if (
    !lookup ||
    getSourceValidUntil({ fetchedAt: lookup.checkedAt, topic: "regulation" }) <= new Date()
  ) {
    return null;
  }

  return { sourceId: lookup.sourceId };
}

export async function recordLawLookup({
  law,
  sourceId,
}: {
  law: LawRequest;
  sourceId: string | null;
}): Promise<void> {
  const key = toLawKey(law);
  const checkedAt = new Date();

  await prisma.lawLookup.upsert({
    create: { ...key, checkedAt, sourceId },
    update: { checkedAt, sourceId },
    where: { lawKey: key },
  });
}

/** `domains` are bare, as research plans keep them: "planalto.gov.br" takes "www4.planalto.gov.br". */
export function isOfficialSite({
  domains,
  url,
}: {
  domains: readonly string[];
  url: string | null;
}): boolean {
  const host = url
    ? URL.parse(url)
        ?.hostname.toLowerCase()
        .replace(/^www\./u, "")
    : null;

  return Boolean(host) && domains.some((domain) => host === domain || host?.endsWith(`.${domain}`));
}

/** A law is read from its official site's whole text: a cut text loses its last articles. */
function isWholeOfficialText({
  candidate,
  law,
}: {
  candidate: ResearchSourceCandidate;
  law: LawRequest;
}): boolean {
  return (
    candidate.length !== null &&
    candidate.length > 0 &&
    candidate.length < getMaxTextLength("regulation") &&
    isOfficialSite({ domains: law.officialDomains, url: candidate.url })
  );
}

function toStoredRequest(law: LawRequest): StoredSourcesRequest {
  return { ...law, publisher: null, topic: "regulation" };
}

async function judgeLawSources({
  ids,
  law,
}: {
  ids: readonly string[];
  law: LawRequest;
}): Promise<string[]> {
  const candidates = await loadResearchSourceCandidates(ids);

  return judgeResearchSources({
    candidates: candidates.filter((candidate) => isWholeOfficialText({ candidate, law })),
    request: toStoredRequest(law),
  });
}

/** Internal workflow bridge: a stored copy of the law's current official text, when one fits. */
export async function findStoredLawSource(law: LawRequest): Promise<string | null> {
  const ids = await searchStoredResearchSources(toStoredRequest(law));
  const [found] = await judgeLawSources({ ids, law });

  return found ?? null;
}

/** Internal workflow bridge: whether a source just stored is the law's whole, current official text. */
export async function isLawSource({
  law,
  sourceId,
}: {
  law: LawRequest;
  sourceId: string;
}): Promise<boolean> {
  const accepted = await judgeLawSources({ ids: [sourceId], law });
  return accepted.length > 0;
}
