import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { fetchDocument, toSourceUrl } from "./fetch-document";
import { type ParsedDocument, hashDocument, parseDocument } from "./parse-document";
import { MAX_PASTED_TEXT_LENGTH, isSourceUploadContentType } from "./source-contract";
import { readUploadedBlob } from "./upload-blob";

/** What the learner gave: a file in their Blob folder, a link or pasted text. */
export type UploadRead =
  | { kind: "file"; pathname: string }
  | { kind: "link"; url: string }
  | { kind: "text"; text: string };

export type UploadContent = {
  blobUrl: string | null;
  contentType: string;
  parsed: ParsedDocument;
  hash: string;
  /** The page a pasted link points at, after redirects. */
  url?: string;
};

/** What a pasted link may point at: a web page, a PDF or plain text. */
const LINK_CONTENT_TYPES = new Set(["application/pdf", "text/html", "text/markdown", "text/plain"]);

/** A page's address without the scheme, readable: "pt.wikipedia.org/wiki/Glicólise". */
function getTitleFromUrl(value: string): string {
  const url = new URL(value);
  const path = decodeURIComponent(url.pathname).replace(/\/+$/u, "");

  return `${url.hostname.replace(/^www\./u, "")}${path}`;
}

/** The file's name, the link's address, or nothing for pasted text. */
export function getDefaultTitle(input: UploadRead): string {
  switch (input.kind) {
    case "file":
      return getTitleFromPathname(input.pathname);
    case "link":
      return URL.canParse(input.url) ? getTitleFromUrl(input.url) : input.url;
    case "text":
      return "";
    default:
      return "";
  }
}

/** The file name the learner chose, without Blob's random suffix and extension. */
function getTitleFromPathname(pathname: string): string {
  const fileName = pathname.split("/").at(-1) ?? pathname;

  return fileName.replace(/-[A-Za-z0-9]{30}(?=\.[^.]+$)/u, "").replace(/\.[^.]+$/u, "");
}

export type ReadContent =
  | { content: UploadContent; status: "ready" }
  | { status: "notFound" }
  | { status: "unsupported" };

function readPastedText(text: string): ReadContent {
  const trimmed = text.trim().slice(0, MAX_PASTED_TEXT_LENGTH);

  if (!trimmed) {
    return { status: "unsupported" };
  }

  const bytes = new TextEncoder().encode(trimmed);

  return {
    content: {
      blobUrl: null,
      contentType: "text/plain",
      hash: hashDocument({ bytes, text: trimmed }),
      parsed: { images: [], pages: null, text: trimmed },
    },
    status: "ready",
  };
}

/**
 * A link the learner pasted: an article or a public PDF, fetched once and read as text. Addresses
 * that aren't public web pages, and pages without text, can't be read.
 */
async function readLinkedPage(value: string): Promise<ReadContent> {
  const url = toSourceUrl(value);

  if (!url) {
    return { status: "unsupported" };
  }

  const { data: fetched } = await safeAsync(() => fetchDocument(url));

  if (!fetched) {
    return { status: "notFound" };
  }

  const { contentType } = fetched;

  if (!LINK_CONTENT_TYPES.has(contentType)) {
    return { status: "unsupported" };
  }

  const { data: parsed } = await safeAsync(() =>
    parseDocument({ bytes: fetched.bytes, contentType }),
  );

  if (!parsed?.text) {
    return { status: "unsupported" };
  }

  return {
    content: {
      blobUrl: null,
      contentType,
      hash: hashDocument({ bytes: fetched.bytes, text: parsed.text }),
      parsed,
      url: fetched.url,
    },
    status: "ready",
  };
}

async function readUploadedFile(pathname: string): Promise<ReadContent> {
  const blob = await readUploadedBlob(pathname);

  if (!blob) {
    return { status: "notFound" };
  }

  if (!isSourceUploadContentType(blob.contentType)) {
    return { status: "unsupported" };
  }

  // A damaged or password-protected file is the learner's to fix, not a server error.
  const { data: parsed } = await safeAsync(() =>
    parseDocument({ bytes: blob.bytes, contentType: blob.contentType }),
  );

  if (!parsed) {
    return { status: "unsupported" };
  }

  return {
    content: {
      blobUrl: blob.url,
      contentType: blob.contentType,
      hash: hashDocument({ bytes: blob.bytes, text: parsed.text }),
      parsed,
    },
    status: "ready",
  };
}

/** Reads what the learner gave: their uploaded file, a pasted link or pasted text. */
export function readUpload(input: UploadRead): Promise<ReadContent> | ReadContent {
  switch (input.kind) {
    case "file":
      return readUploadedFile(input.pathname);
    case "link":
      return readLinkedPage(input.url);
    case "text":
      return readPastedText(input.text);
    default:
      return { status: "unsupported" };
  }
}
