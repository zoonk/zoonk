import "server-only";
import { createHash } from "node:crypto";
import { isJsonObject } from "@zoonk/utils/json";
import { normalizeContentType } from "@zoonk/utils/upload";
import { type OfficeParserAST, type SupportedFileType, parseOffice } from "officeparser";
import {
  DOCX_CONTENT_TYPE,
  IMAGE_CONTENT_TYPES,
  PAGE_BREAK,
  PDF_CONTENT_TYPE,
  PPTX_CONTENT_TYPE,
  TEXT_CONTENT_TYPES,
} from "./source-contract";

const MAX_EXTRACTED_TEXT_LENGTH = 500_000;

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

/** PostgreSQL text cannot store NUL; preserve page breaks so citations retain their page numbers. */
function limitText(text: string): string {
  return text
    .replaceAll("\u0000", "")
    .replaceAll(/^[^\S\f]+|[^\S\f]+$/gu, "")
    .slice(0, MAX_EXTRACTED_TEXT_LENGTH);
}

export function isCutText(text: string | null): boolean {
  return text !== null && text.length >= MAX_EXTRACTED_TEXT_LENGTH;
}

function getPageNumber(node: OfficeParserAST["content"][number], position: number): number {
  const metadata = isJsonObject(node.metadata) ? node.metadata : {};
  const number = metadata.slideNumber ?? metadata.pageNumber;

  return typeof number === "number" ? number : position + 1;
}

async function readText(ast: OfficeParserAST): Promise<string> {
  const { value } = await ast.to("text");
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
}: {
  bytes: Uint8Array;
  fileType: SupportedFileType;
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
    : await readText(ast);

  return {
    images: ast.attachments
      .filter((attachment) => MODEL_IMAGE_TYPES.has(attachment.mimeType))
      .map((attachment) => ({ data: attachment.data, mediaType: attachment.mimeType })),
    pages: countPages(ast),
    text: limitText(text),
  };
}

export async function parseDocument({
  bytes,
  contentType,
}: {
  bytes: Uint8Array;
  contentType: string;
}): Promise<ParsedDocument> {
  const type = normalizeContentType(contentType);
  const fileType = OFFICE_FILE_TYPES[type];

  if (fileType) {
    return parseOfficeDocument({ bytes, fileType });
  }

  if (TEXT_CONTENT_TYPES.some((textType) => textType === type)) {
    return { images: [], pages: null, text: limitText(new TextDecoder().decode(bytes)) };
  }

  if (MODEL_IMAGE_TYPES.has(type)) {
    return { images: [], pages: null, text: null };
  }

  throw new Error(`Unsupported document type: ${type}`);
}
