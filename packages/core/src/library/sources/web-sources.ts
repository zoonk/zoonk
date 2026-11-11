import "server-only";
import { type Source, prisma } from "@zoonk/db";
import { buildSourceIdentityKey } from "@zoonk/utils/identity-key";
import { getSourceIdentitySearch } from "../identity/kinds/source-identity";
import { resolveLibraryIdentity } from "../identity/resolve-library-identity";
import { toRegistrableDomain } from "../products/product-keys";
import { READABLE_SOURCE_FILTER } from "./_utils/readable-sources";
import { PermanentDocumentError, fetchDocument } from "./fetch-document";
import { isFileNameTitle } from "./file-name-title";
import { getSourceValidUntil } from "./freshness-schedule";
import { hashDocument, hashFirstReading, parseDocument } from "./parse-document";
import { getKnownReusePolicy } from "./reuse-policy";
import {
  SOURCE_READ_VERSION,
  type SourceStructure,
  type SourceTopic,
  sourceStructureSchema,
} from "./source-contract";
import { oweSourceChangeNotice } from "./unnoticed-changes";

type WebSource = Omit<Source, "extractedText">;

export type StoreWebSourceInput = {
  url: string;
  kind: "official" | "secondary";
  language: string;
  publisher: string | null;
  title: string;
  topic: SourceTopic;
  /** Checks the address the fetch ended at, after redirects; a page it rejects is never stored. */
  acceptUrl?: (url: string) => boolean;
};

export async function fetchAndParse(url: string, topic?: SourceTopic) {
  const document = await fetchDocument(url);

  const parsed = await parseDocument({
    bytes: document.bytes,
    charset: document.charset,
    contentType: document.contentType,
    topic,
  });

  return {
    contentHash: hashDocument({ bytes: document.bytes, text: parsed.text }),
    contentType: document.contentType,
    document,
    parsed,
    url: document.url,
  };
}

/** Only a source an older reader stored needs the first reading's hash to tell a re-read apart. */
function hashStoredReading({
  fetched,
  readVersion,
}: {
  fetched: Awaited<ReturnType<typeof fetchAndParse>>;
  readVersion: number;
}): Promise<string> | null {
  return readVersion < SOURCE_READ_VERSION ? hashFirstReading(fetched.document) : null;
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

function toSourceContent({
  fetched,
  now,
  topic,
  validUntil,
}: {
  fetched: Awaited<ReturnType<typeof fetchAndParse>>;
  now: Date;
  topic: SourceTopic;
  validUntil: Date | null;
}) {
  return {
    contentHash: fetched.contentHash,
    extractedText: fetched.parsed.text,
    fetchedAt: now,
    mimeType: fetched.contentType,
    readVersion: SOURCE_READ_VERSION,
    structure: toStructure({ parsed: fetched.parsed, topic }),
    validUntil,
  };
}

function saveChangedContent({
  content,
  firstReadingHash,
  sourceId,
  topic,
}: {
  content: ReturnType<typeof toSourceContent> & { title?: string };
  firstReadingHash: string | null;
  sourceId: string;
  topic: SourceTopic;
}): Promise<WebSource> {
  return prisma.$transaction(async (tx) => {
    const owed = await oweSourceChangeNotice({
      firstReadingHash,
      sourceId,
      text: content.extractedText,
      topic,
      tx,
    });

    return tx.source.update({
      data: { ...content, ...owed },
      omit: { extractedText: true },
      where: { id: sourceId },
    });
  });
}

export async function storeWebSource(input: StoreWebSourceInput): Promise<WebSource> {
  const fetched = await fetchAndParse(input.url, input.topic);

  if (input.acceptUrl && !input.acceptUrl(fetched.url)) {
    throw new PermanentDocumentError(
      `${input.url} redirected to ${fetched.url}, which isn't accepted`,
    );
  }

  const identityKey = buildSourceIdentityKey({ contentHash: null, url: fetched.url });
  const where = { languageIdentity: { identityKey, language: input.language } };
  const now = new Date();

  const content = toSourceContent({
    fetched,
    now,
    topic: input.topic,
    validUntil: getSourceValidUntil({ fetchedAt: now, topic: input.topic }),
  });

  const stored = await prisma.source.findUnique({
    select: { contentHash: true, id: true, readVersion: true, title: true },
    where,
  });

  // A name learners and statute drills read is never replaced; a page's file name is.
  const retitle =
    stored && isFileNameTitle(stored.title) && !isFileNameTitle(input.title)
      ? { title: input.title }
      : {};

  if (stored && stored.contentHash !== content.contentHash) {
    return saveChangedContent({
      content: { ...content, ...retitle },
      firstReadingHash: await hashStoredReading({ fetched, readVersion: stored.readVersion }),
      sourceId: stored.id,
      topic: input.topic,
    });
  }

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
    update: { ...content, ...retitle },
    where,
  });
}

export async function getWebSourceSearchSubject(
  input: Pick<StoreWebSourceInput, "language" | "publisher" | "title" | "url">,
) {
  const search = getSourceIdentitySearch({ ...input, contentHash: null, kind: "source" });
  return (await search.findExact()) ? null : search.aiSubject;
}

export async function findWebSourceCopy({
  analytics,
  searchTerms,
  ...input
}: Pick<StoreWebSourceInput, "language" | "publisher" | "title" | "url"> & {
  analytics?: Parameters<typeof resolveLibraryIdentity>[0]["analytics"];
  searchTerms?: readonly string[];
}): Promise<string | null> {
  const resolution = await resolveLibraryIdentity({
    analytics,
    request: { ...input, contentHash: null, kind: "source" },
    searchTerms,
  });

  return resolution.kind === "existing" && resolution.match === "search" ? resolution.id : null;
}

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

export type SourceRefresh = { source: WebSource; status: "changed" | "unchanged" };

function getTopic(source: WebSource): SourceTopic {
  return sourceStructureSchema.safeParse(source.structure).data?.topic ?? "regulation";
}

export async function refreshWebSource(sourceId: string): Promise<SourceRefresh | null> {
  const source = await prisma.source.findUnique({
    omit: { extractedText: true },
    where: { id: sourceId },
  });

  if (!source?.url) {
    return null;
  }

  const topic = getTopic(source);
  const fetched = await fetchAndParse(source.url, topic);
  const now = new Date();

  // A product page was official where research found it; another site's page never replaces it.
  if (topic === "product" && toRegistrableDomain(fetched.url) !== toRegistrableDomain(source.url)) {
    throw new PermanentDocumentError(`${source.url} now redirects to ${fetched.url}`);
  }

  if (fetched.contentHash === source.contentHash) {
    const updated = await prisma.source.update({
      data: { fetchedAt: now, readVersion: SOURCE_READ_VERSION },
      omit: { extractedText: true },
      where: { id: source.id },
    });

    return { source: updated, status: "unchanged" };
  }

  const content = toSourceContent({
    fetched,
    now,
    topic,
    validUntil:
      topic === "exam" ? source.validUntil : getSourceValidUntil({ fetchedAt: now, topic }),
  });

  return {
    source: await saveChangedContent({
      content,
      firstReadingHash: await hashStoredReading({ fetched, readVersion: source.readVersion }),
      sourceId: source.id,
      topic,
    }),
    status: "changed",
  };
}
