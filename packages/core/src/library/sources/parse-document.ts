import "server-only";
import { createHash } from "node:crypto";
import { isJsonObject } from "@zoonk/utils/json";
import { normalizeContentType } from "@zoonk/utils/upload";
import {
  type OfficeContentNode,
  type OfficeParserAST,
  type SupportedFileType,
  parseOffice,
} from "officeparser";
import { decodePage } from "./decode-page";
import {
  DOCX_CONTENT_TYPE,
  IMAGE_CONTENT_TYPES,
  PAGE_BREAK,
  PDF_CONTENT_TYPE,
  PPTX_CONTENT_TYPE,
  type SourceTopic,
  TEXT_CONTENT_TYPES,
} from "./source-contract";

const MAX_EXTRACTED_TEXT_LENGTH = 500_000;

/** The consolidated Brazilian Constitution is about 1.06 million characters. */
const MAX_LAW_TEXT_LENGTH = 2_000_000;

const OFFICE_FILE_TYPES: Readonly<Record<string, SupportedFileType>> = {
  [DOCX_CONTENT_TYPE]: "docx",
  [PDF_CONTENT_TYPE]: "pdf",
  [PPTX_CONTENT_TYPE]: "pptx",
  "text/html": "html",
};

const MODEL_IMAGE_TYPES = new Set<string>(IMAGE_CONTENT_TYPES);

const PAGED_FILE_TYPES = new Set<SupportedFileType>(["pdf", "pptx"]);

const MAX_PAGE_CHUNK = 100_000;

export type DocumentImage = { data: string; mediaType: string };

export type ParsedDocument = { text: string | null; images: DocumentImage[]; pages: number | null };

function hashContent(content: Uint8Array | string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function hashDocument({ bytes, text }: { bytes: Uint8Array; text: string | null }): string {
  return hashContent(text || bytes);
}

/** A law is read whole, so its text keeps more than an upload's. */
export function getMaxTextLength(topic?: SourceTopic | null): number {
  return topic === "regulation" ? MAX_LAW_TEXT_LENGTH : MAX_EXTRACTED_TEXT_LENGTH;
}

/** PostgreSQL text cannot store NUL; preserve page breaks so citations retain their page numbers. */
function limitText({ maxLength, text }: { maxLength: number; text: string }): string {
  return text
    .replaceAll("\u0000", "")
    .replaceAll(/^[^\S\f]+|[^\S\f]+$/gu, "")
    .slice(0, maxLength);
}

export function isCutText(
  text: string | null,
  maxLength: number = MAX_EXTRACTED_TEXT_LENGTH,
): boolean {
  return text !== null && text.length >= maxLength;
}

function getPageNumber(node: OfficeParserAST["content"][number], position: number): number {
  const metadata = isJsonObject(node.metadata) ? node.metadata : {};
  const number = metadata.slideNumber ?? metadata.pageNumber;

  return typeof number === "number" ? number : position + 1;
}

/** How bytes become text. A change to it moves `SOURCE_READ_VERSION`. */
type Reading = { decodesCharset: boolean; dropsStruckText: boolean; maxLength: number };

/** Official law sites strike through wording a later law revoked and keep it on the page. */
function toReading(topic?: SourceTopic | null): Reading {
  return {
    decodesCharset: true,
    dropsStruckText: topic === "regulation",
    maxLength: getMaxTextLength(topic),
  };
}

/** Reader version 0, which stored the sources saved before `readVersion` existed. */
const FIRST_READING: Reading = {
  decodesCharset: false,
  dropsStruckText: false,
  maxLength: MAX_EXTRACTED_TEXT_LENGTH,
};

function dropStruckText(node: OfficeContentNode): false | undefined {
  return node.formatting?.strikethrough ? false : undefined;
}

async function readText({
  ast,
  reading,
}: {
  ast: OfficeParserAST;
  reading: Reading;
}): Promise<string> {
  const { value } = await ast.to(
    "text",
    reading.dropsStruckText ? { onNode: dropStruckText } : undefined,
  );

  return value;
}

function countPages(ast: OfficeParserAST): number | null {
  const pages = ast.content
    .filter((node) => node.type === "page" || node.type === "slide")
    .map((node, position) => getPageNumber(node, position));

  return pages.length > 0 ? Math.max(...pages) : null;
}

async function readPagedText({
  ast,
  fileType,
}: {
  ast: OfficeParserAST;
  fileType: SupportedFileType;
}): Promise<string> {
  const { value: chunks } = await ast.to("chunks", {
    chunksConfig: {
      maxChunkSize: MAX_PAGE_CHUNK,
      splitBy: fileType === "pptx" ? "slide" : "page",
      strategy: "document-structure",
    },
  });

  const byPage = Map.groupBy(
    chunks.filter((chunk) => chunk.text.trim()),
    (chunk) => chunk.metadata.slideNumber ?? chunk.metadata.pageNumber ?? 1,
  );

  return Array.from({ length: countPages(ast) ?? 1 }, (_, index) =>
    (byPage.get(index + 1) ?? []).map((chunk) => chunk.text.trim()).join("\n"),
  ).join(PAGE_BREAK);
}

async function parseOfficeDocument({
  bytes,
  fileType,
  reading,
}: {
  bytes: Uint8Array;
  fileType: SupportedFileType;
  reading: Reading;
}): Promise<ParsedDocument> {
  const ast = await parseOffice(Buffer.from(bytes), {
    extractAttachments: fileType === "docx" || fileType === "pptx",
    fileType,
    ignoreComments: true,
    // Flowing text keeps a quoted passage findable; the layout grid pads it with spaces.
    ignorePageGeometry: true,
  });

  const text = PAGED_FILE_TYPES.has(fileType)
    ? await readPagedText({ ast, fileType })
    : await readText({ ast, reading });

  return {
    images: ast.attachments
      .filter((attachment) => MODEL_IMAGE_TYPES.has(attachment.mimeType))
      .map((attachment) => ({ data: attachment.data, mediaType: attachment.mimeType })),
    pages: countPages(ast),
    text: limitText({ maxLength: reading.maxLength, text }),
  };
}

type DocumentBytes = {
  bytes: Uint8Array;
  /** The charset the response declared, for a fetched page. */
  charset?: string | null;
  contentType: string;
};

async function readDocument({
  bytes,
  charset,
  contentType,
  reading,
}: DocumentBytes & { reading: Reading }): Promise<ParsedDocument> {
  const type = normalizeContentType(contentType);
  const fileType = OFFICE_FILE_TYPES[type];

  if (fileType === "html") {
    const page = reading.decodesCharset ? Buffer.from(decodePage({ bytes, charset })) : bytes;
    return parseOfficeDocument({ bytes: page, fileType, reading });
  }

  if (fileType) {
    return parseOfficeDocument({ bytes, fileType, reading });
  }

  if (TEXT_CONTENT_TYPES.some((textType) => textType === type)) {
    const text = reading.decodesCharset
      ? decodePage({ bytes, charset })
      : new TextDecoder().decode(bytes);

    return { images: [], pages: null, text: limitText({ maxLength: reading.maxLength, text }) };
  }

  if (MODEL_IMAGE_TYPES.has(type)) {
    return { images: [], pages: null, text: null };
  }

  throw new Error(`Unsupported document type: ${type}`);
}

export function parseDocument({
  topic,
  ...document
}: DocumentBytes & { topic?: SourceTopic }): Promise<ParsedDocument> {
  return readDocument({ ...document, reading: toReading(topic) });
}

/**
 * The hash these bytes had under reader version 0. When it's the hash a source stored then, the
 * page hasn't changed since: only how it's read did, which learners aren't told about.
 */
export async function hashFirstReading(document: DocumentBytes): Promise<string> {
  const parsed = await readDocument({ ...document, reading: FIRST_READING });
  return hashDocument({ bytes: document.bytes, text: parsed.text });
}
