import "server-only";
import { type Source, prisma } from "@zoonk/db";
import { buildSourceIdentityKey } from "@zoonk/utils/identity-key";
import { resolveLibraryIdentity } from "../identity/resolve-library-identity";
import { READABLE_SOURCE_FILTER } from "./_utils/readable-sources";
import { fetchDocument } from "./fetch-document";
import { getSourceValidUntil } from "./freshness-schedule";
import { hashDocument, parseDocument } from "./parse-document";
import { getKnownReusePolicy } from "./reuse-policy";
import { type SourceStructure, type SourceTopic, sourceStructureSchema } from "./source-contract";
import { summarizeTextChange } from "./text-change";

type WebSource = Omit<Source, "extractedText">;

export type StoreWebSourceInput = {
  url: string;
  kind: "official" | "secondary";
  language: string;
  publisher: string | null;
  title: string;
  topic: SourceTopic;
};

async function fetchAndParse(url: string) {
  const document = await fetchDocument(url);
  const parsed = await parseDocument({ bytes: document.bytes, contentType: document.contentType });

  return {
    contentHash: hashDocument({ bytes: document.bytes, text: parsed.text }),
    contentType: document.contentType,
    parsed,
    url: document.url,
  };
}

function toStructure({
  parsed,
  topic,
}: {
  parsed: { images: unknown[]; pages: number | null };
  topic: SourceTopic;
}): SourceStructure {
  return { images: parsed.images.length, pages: parsed.pages, topic };
}

/**
 * Fetches a page or document research found and stores it once per canonical
 * address. A second research run for the same notice only refreshes the fetch
 * time; a new version replaces the stored text and hash.
 */
export async function storeWebSource(input: StoreWebSourceInput): Promise<WebSource> {
  const fetched = await fetchAndParse(input.url);
  const identityKey = buildSourceIdentityKey({ contentHash: null, url: fetched.url });
  const now = new Date();

  const content = {
    contentHash: fetched.contentHash,
    extractedText: fetched.parsed.text,
    fetchedAt: now,
    mimeType: fetched.contentType,
    structure: toStructure({ parsed: fetched.parsed, topic: input.topic }),
    validUntil: getSourceValidUntil({ fetchedAt: now, topic: input.topic }),
  };

  return prisma.source.upsert({
    create: {
      ...content,
      identityKey,
      kind: input.kind,
      language: input.language,
      publisher: input.publisher,
      reusePolicy:
        getKnownReusePolicy({ publisher: input.publisher, url: fetched.url }) ?? undefined,
      title: input.title,
      url: fetched.url,
      visibility: "public",
    },
    omit: { extractedText: true },
    update: content,
    where: { languageIdentity: { identityKey, language: input.language } },
  });
}

/**
 * The Library's copy of a document research found at another address (a mirror, or a copy on the
 * organizer's file server), found through search terms, text search and the reuse decision, so
 * it's reused without a fetch. Null when there is none, or when the Library holds this very
 * address: that one is fetched again, so a notice republished at its old address is read fresh.
 */
export async function findWebSourceCopy({
  analytics,
  ...input
}: Pick<StoreWebSourceInput, "language" | "publisher" | "title" | "url"> & {
  analytics?: Parameters<typeof resolveLibraryIdentity>[0]["analytics"];
}): Promise<string | null> {
  const resolution = await resolveLibraryIdentity({
    analytics,
    request: { ...input, contentHash: null, kind: "source" },
  });

  return resolution.kind === "existing" && resolution.match === "search" ? resolution.id : null;
}

/**
 * The sources a model can read, in the order given. Research reads a few documents per goal, so a
 * page that stored no text (built with JavaScript) mustn't take the place of the notice itself.
 */
export async function listReadableSourceIds(sourceIds: readonly string[]): Promise<string[]> {
  if (sourceIds.length === 0) {
    return [];
  }

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT s.id FROM sources s
    WHERE s.id = ANY(${[...sourceIds]}::uuid[]) AND ${READABLE_SOURCE_FILTER}`;

  const readable = new Set(rows.map((row) => row.id));

  return sourceIds.filter((id) => readable.has(id));
}

export type SourceRefresh =
  | { change: null; source: WebSource; status: "unchanged" }
  | { change: string | null; previousHash: string; source: WebSource; status: "changed" };

function getTopic(source: Source): SourceTopic {
  return sourceStructureSchema.safeParse(source.structure).data?.topic ?? "regulation";
}

/**
 * A freshness check: fetch the source again and compare hashes. Only a changed
 * hash stores the new text, and the excerpt of what changed lets a model
 * describe it without reading both versions.
 */
export async function refreshWebSource(sourceId: string): Promise<SourceRefresh | null> {
  const source = await prisma.source.findUnique({ where: { id: sourceId } });

  if (!source?.url) {
    return null;
  }

  const fetched = await fetchAndParse(source.url);
  const now = new Date();

  if (fetched.contentHash === source.contentHash) {
    const updated = await prisma.source.update({
      data: { fetchedAt: now },
      omit: { extractedText: true },
      where: { id: source.id },
    });

    return { change: null, source: updated, status: "unchanged" };
  }

  const topic = getTopic(source);

  const updated = await prisma.source.update({
    data: {
      contentHash: fetched.contentHash,
      extractedText: fetched.parsed.text,
      fetchedAt: now,
      mimeType: fetched.contentType,
      structure: toStructure({ parsed: fetched.parsed, topic }),
      validUntil:
        topic === "exam" ? source.validUntil : getSourceValidUntil({ fetchedAt: now, topic }),
    },
    omit: { extractedText: true },
    where: { id: source.id },
  });

  return {
    change: summarizeTextChange({ current: fetched.parsed.text, previous: source.extractedText }),
    previousHash: source.contentHash,
    source: updated,
    status: "changed",
  };
}
