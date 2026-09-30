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

/** Keeps pathological documents from filling a row. A text cut here is exactly this long. */
const MAX_EXTRACTED_TEXT_LENGTH = 500_000;

const OFFICE_FILE_TYPES: Readonly<Record<string, SupportedFileType>> = {
  [DOCX_CONTENT_TYPE]: "docx",
  [PDF_CONTENT_TYPE]: "pdf",
  [PPTX_CONTENT_TYPE]: "pptx",
  "text/html": "html",
};

/** Images models can read. Office files also embed EMF and TIFF drawings, which they can't. */
const MODEL_IMAGE_TYPES = new Set<string>(IMAGE_CONTENT_TYPES);

/** Slides and PDF pages keep their numbers, so lessons can cite the page they teach from. */
const PAGED_FILE_TYPES = new Set<SupportedFileType>(["pdf", "pptx"]);

/**
 * Large enough that a page is never cut: chunks only serve to know which page each paragraph is
 * on.
 */
const MAX_PAGE_CHUNK = 100_000;

export type DocumentImage = { data: string; mediaType: string };

export type ParsedDocument = {
  /** Plain text, or null for images, which models read as files. */
  text: string | null;
  images: DocumentImage[];
  pages: number | null;
};

/** The same bytes always hash the same, so a document is stored once however it arrives. */
function hashContent(content: Uint8Array | string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Web pages carry timestamps and tokens that change on every fetch, so a
 * document with text is identified by its text. Images and scans without text
 * are identified by their bytes.
 */
export function hashDocument({ bytes, text }: { bytes: Uint8Array; text: string | null }): string {
  return hashContent(text || bytes);
}

/** Trims spaces and line breaks but keeps page breaks, so an empty first page still counts. */
function limitText(text: string): string {
  return text.replaceAll(/^[^\S\f]+|[^\S\f]+$/gu, "").slice(0, MAX_EXTRACTED_TEXT_LENGTH);
}

/** Whether a stored text is only the start of its document, cut at the length a row keeps. */
export function isCutText(text: string | null): boolean {
  return text !== null && text.length >= MAX_EXTRACTED_TEXT_LENGTH;
}

/** The page or slide number a top-level node says it is, since slides without text are left out. */
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

/**
 * The text of a paged document, page by page, with a page break between pages: page N of the text
 * is page N (or slide N) of the file, and a page without text stays an empty page.
 */
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

/**
 * Turns an uploaded or fetched file into what models and checks read: Word and
 * PowerPoint become text and images, PDFs and web pages become text (the PDF
 * still goes to models as a file, the text is for search and citation checks),
 * text and Markdown are read as UTF-8, and images stay files.
 */
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
