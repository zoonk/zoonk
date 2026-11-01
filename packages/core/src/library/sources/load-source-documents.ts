import "server-only";
import { type Source, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { PermanentDocumentError, fetchDocument } from "./fetch-document";
import { type DocumentImage, isCutText, parseDocument } from "./parse-document";
import {
  DOCX_CONTENT_TYPE,
  IMAGE_CONTENT_TYPES,
  PDF_CONTENT_TYPE,
  PPTX_CONTENT_TYPE,
} from "./source-contract";
import { readUploadedBlob } from "./upload-blob";

const NATIVE_FILE_TYPES = new Set<string>([PDF_CONTENT_TYPE, ...IMAGE_CONTENT_TYPES]);
const OFFICE_TYPES = new Set<string>([DOCX_CONTENT_TYPE, PPTX_CONTENT_TYPE]);

export type SourceDocument = {
  contentHash: string;
  file: { data: Uint8Array | URL; mediaType: string } | null;
  id: string;
  images: DocumentImage[];
  publisher: string | null;
  text: string | null;
  title: string;
  url: string | null;
};

/** Only private uploads keep a file; a public source's is the publisher's, read where it lives. */
async function readSourceFile({ blobUrl, mimeType, url }: Source): Promise<Uint8Array | null> {
  if (blobUrl) {
    const blob = await readUploadedBlob(blobUrl);
    return blob?.bytes ?? null;
  }

  if (!url) {
    return null;
  }

  const { data: fetched, error } = await safeAsync(() => fetchDocument(url));

  if (error && !(error instanceof PermanentDocumentError)) {
    throw error;
  }

  return fetched?.contentType === mimeType ? fetched.bytes : null;
}

async function loadSourceFiles(source: Source) {
  const mediaType = source.mimeType ?? "";

  if (mediaType === PDF_CONTENT_TYPE && isCutText(source.extractedText)) {
    return { file: null, images: [] };
  }

  if (source.url && !source.blobUrl && NATIVE_FILE_TYPES.has(mediaType)) {
    return { file: { data: new URL(source.url), mediaType }, images: [] };
  }

  const bytes =
    NATIVE_FILE_TYPES.has(mediaType) || OFFICE_TYPES.has(mediaType)
      ? await readSourceFile(source)
      : null;

  if (!bytes) {
    return { file: null, images: [] };
  }

  if (NATIVE_FILE_TYPES.has(mediaType)) {
    return { file: { data: bytes, mediaType }, images: [] };
  }

  const parsed = await parseDocument({ bytes, contentType: mediaType });

  return { file: null, images: parsed.images };
}

async function toSourceDocument(source: Source): Promise<SourceDocument> {
  const { file, images } = await loadSourceFiles(source);

  return {
    contentHash: source.contentHash,
    file,
    id: source.id,
    images,
    publisher: source.publisher,
    text: source.extractedText,
    title: source.title,
    url: source.url,
  };
}

/** Internal: callers must authorize access to the source ids before reading private files. */
export async function loadSourceDocuments(sourceIds: string[]): Promise<SourceDocument[]> {
  const sources = await prisma.source.findMany({ where: { id: { in: sourceIds } } });
  const byId = new Map(sources.map((source) => [source.id, source]));

  const ordered = sourceIds
    .map((sourceId) => byId.get(sourceId))
    .filter((source) => source !== undefined);

  return Promise.all(ordered.map((source) => toSourceDocument(source)));
}
