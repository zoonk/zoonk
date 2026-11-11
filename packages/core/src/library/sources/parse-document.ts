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

/**
 * Pages that declare no charset and aren't UTF-8 are windows-1252, as browsers read them: Planalto
 * serves its laws that way.
 */
function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
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

/** Official law sites strike through wording a later law revoked and keep it on the page. */
function dropStruckText(node: OfficeContentNode): false | undefined {
  return node.formatting?.strikethrough ? false : undefined;
}

async function readText({ ast, isLaw }: { ast: OfficeParserAST; isLaw: boolean }): Promise<string> {
  const { value } = await ast.to("text", isLaw ? { onNode: dropStruckText } : undefined);
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
  topic,
}: {
  bytes: Uint8Array;
  fileType: SupportedFileType;
  topic?: SourceTopic;
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
    : await readText({ ast, isLaw: topic === "regulation" });

  return {
    images: ast.attachments
      .filter((attachment) => MODEL_IMAGE_TYPES.has(attachment.mimeType))
      .map((attachment) => ({ data: attachment.data, mediaType: attachment.mimeType })),
    pages: countPages(ast),
    text: limitText({ maxLength: getMaxTextLength(topic), text }),
  };
}

export async function parseDocument({
  bytes,
  contentType,
  topic,
}: {
  bytes: Uint8Array;
  contentType: string;
  topic?: SourceTopic;
}): Promise<ParsedDocument> {
  const type = normalizeContentType(contentType);
  const fileType = OFFICE_FILE_TYPES[type];

  if (fileType === "html") {
    return parseOfficeDocument({ bytes: Buffer.from(decodeText(bytes)), fileType, topic });
  }

  if (fileType) {
    return parseOfficeDocument({ bytes, fileType, topic });
  }

  if (TEXT_CONTENT_TYPES.some((textType) => textType === type)) {
    const text = decodeText(bytes);

    return {
      images: [],
      pages: null,
      text: limitText({ maxLength: getMaxTextLength(topic), text }),
    };
  }

  if (MODEL_IMAGE_TYPES.has(type)) {
    return { images: [], pages: null, text: null };
  }

  throw new Error(`Unsupported document type: ${type}`);
}
