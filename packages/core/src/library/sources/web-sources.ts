import "server-only";
import { type Source, prisma } from "@zoonk/db";
import { buildSourceIdentityKey } from "@zoonk/utils/identity-key";
import { getSourceIdentitySearch } from "../identity/kinds/source-identity";
import { resolveLibraryIdentity } from "../identity/resolve-library-identity";
import { READABLE_SOURCE_FILTER } from "./_utils/readable-sources";
import { fetchDocument } from "./fetch-document";
import { getSourceValidUntil } from "./freshness-schedule";
import { hashDocument, parseDocument } from "./parse-document";
import { getKnownReusePolicy } from "./reuse-policy";
import { type SourceStructure, type SourceTopic, sourceStructureSchema } from "./source-contract";
import { oweSourceChangeNotice } from "./unnoticed-changes";

type WebSource = Omit<Source, "extractedText">;

export type StoreWebSourceInput = {
  url: string;
  kind: "official" | "secondary";
  language: string;
  publisher: string | null;
  title: string;
  topic: SourceTopic;
};

export async function fetchAndParse(url: string) {
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
    structure: toStructure({ parsed: fetched.parsed, topic }),
    validUntil,
  };
}

function saveChangedContent({
  content,
  sourceId,
  topic,
}: {
  content: ReturnType<typeof toSourceContent>;
  sourceId: string;
  topic: SourceTopic;
}): Promise<WebSource> {
  return prisma.$transaction(async (tx) => {
    await oweSourceChangeNotice({
      changedAt: content.fetchedAt,
      sourceId,
      text: content.extractedText,
      topic,
      tx,
    });

    return tx.source.update({
      data: content,
      omit: { extractedText: true },
      where: { id: sourceId },
    });
  });
}

export async function storeWebSource(input: StoreWebSourceInput): Promise<WebSource> {
  const fetched = await fetchAndParse(input.url);
  const identityKey = buildSourceIdentityKey({ contentHash: null, url: fetched.url });
  const where = { languageIdentity: { identityKey, language: input.language } };
  const now = new Date();

  const content = toSourceContent({
    fetched,
    now,
    topic: input.topic,
    validUntil: getSourceValidUntil({ fetchedAt: now, topic: input.topic }),
  });

  const stored = await prisma.source.findUnique({ select: { contentHash: true, id: true }, where });

  if (stored && stored.contentHash !== content.contentHash) {
    return saveChangedContent({ content, sourceId: stored.id, topic: input.topic });
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
    update: content,
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

  const fetched = await fetchAndParse(source.url);
  const now = new Date();

  if (fetched.contentHash === source.contentHash) {
    const updated = await prisma.source.update({
      data: { fetchedAt: now },
      omit: { extractedText: true },
      where: { id: source.id },
    });

    return { source: updated, status: "unchanged" };
  }

  const topic = getTopic(source);

  const content = toSourceContent({
    fetched,
    now,
    topic,
    validUntil:
      topic === "exam" ? source.validUntil : getSourceValidUntil({ fetchedAt: now, topic }),
  });

  return {
    source: await saveChangedContent({ content, sourceId: source.id, topic }),
    status: "changed",
  };
}
