import "server-only";
import { type Source, prisma } from "@zoonk/db";
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

/** One source as a model reads it: its text, the file itself for PDFs and images, and slide images. */
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

/**
 * PDFs and images go to models as they are. A public web PDF is passed by its
 * address; an upload is read from private storage, since only the server can
 * read it. Word and PowerPoint are parsed again for their images, which aren't
 * stored apart from the file. A PDF whose stored text was cut goes as that text
 * instead: code checks every passage a model quotes against it, so the model
 * reads only what can be checked (quotes from the later pages of the SAT's
 * 227-page framework could never pass).
 */
async function loadSourceFiles(source: Source) {
  const mediaType = source.mimeType ?? "";

  if (mediaType === PDF_CONTENT_TYPE && isCutText(source.extractedText)) {
    return { file: null, images: [] };
  }

  if (source.url && !source.blobUrl && mediaType === PDF_CONTENT_TYPE) {
    return { file: { data: new URL(source.url), mediaType }, images: [] };
  }

  const needsBlob = NATIVE_FILE_TYPES.has(mediaType) || OFFICE_TYPES.has(mediaType);
  const blob = source.blobUrl && needsBlob ? await readUploadedBlob(source.blobUrl) : null;

  if (!blob) {
    return { file: null, images: [] };
  }

  if (NATIVE_FILE_TYPES.has(mediaType)) {
    return { file: { data: blob.bytes, mediaType }, images: [] };
  }

  const parsed = await parseDocument({ bytes: blob.bytes, contentType: mediaType });

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

/** Loads the given sources in the order asked, skipping ids that no longer exist. */
export async function loadSourceDocuments(sourceIds: string[]): Promise<SourceDocument[]> {
  const sources = await prisma.source.findMany({ where: { id: { in: sourceIds } } });
  const byId = new Map(sources.map((source) => [source.id, source]));

  const ordered = sourceIds
    .map((sourceId) => byId.get(sourceId))
    .filter((source) => source !== undefined);

  return Promise.all(ordered.map((source) => toSourceDocument(source)));
}
