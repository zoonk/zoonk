import { z } from "zod";

const BYTES_PER_MB = 1024 * 1024;

/**
 * Gemini accepts at most 20 MB of inline file data per request, the lowest
 * limit among the models that read uploads, so a PDF under it can go to any of
 * them as it is.
 */
const MAX_UPLOAD_SIZE_MB = 20;
export const MAX_SOURCE_UPLOAD_BYTES = MAX_UPLOAD_SIZE_MB * BYTES_PER_MB;

/** Ends each page of a slide deck's or PDF's stored text, so the text splits back into pages. */
export const PAGE_BREAK = "\f";

/** Pasted text is capped like a long chapter; longer material should be a file. */
export const MAX_PASTED_TEXT_LENGTH = 200_000;

export const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const PPTX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export const PDF_CONTENT_TYPE = "application/pdf";

/** Text and Markdown are read as UTF-8 text; the rest are parsed or passed to models as files. */
export const TEXT_CONTENT_TYPES = ["text/plain", "text/markdown"] as const;

export const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const SOURCE_UPLOAD_CONTENT_TYPES = [
  PDF_CONTENT_TYPE,
  DOCX_CONTENT_TYPE,
  PPTX_CONTENT_TYPE,
  ...TEXT_CONTENT_TYPES,
  ...IMAGE_CONTENT_TYPES,
] as const;

export type SourceUploadContentType = (typeof SOURCE_UPLOAD_CONTENT_TYPES)[number];

export function isSourceUploadContentType(value: string): value is SourceUploadContentType {
  return SOURCE_UPLOAD_CONTENT_TYPES.some((contentType) => contentType === value);
}

/**
 * Whether past exam questions from a source may be quoted, with the terms that
 * say so. `unknown` means items are written as original questions.
 */
export const reusePolicySchema = z.object({
  basis: z.string(),
  honorTakedowns: z.boolean(),
  pastQuestions: z.enum(["allowedWithCitation", "notAllowed", "unknown"]),
  termsUrl: z.string().nullable(),
});

export type ReusePolicy = z.infer<typeof reusePolicySchema>;

/**
 * What a fetched source is about decides how long it stays trusted before it's
 * checked again: exam notices until the exam, laws and taxes 30
 * days, software 90 days. Reference syllabi a big learn goal is checked against
 * change slowly, so they're never checked for freshness and are reused for a year.
 */
const SOURCE_TOPICS = ["exam", "regulation", "software", "syllabus"] as const;

export type SourceTopic = (typeof SOURCE_TOPICS)[number];

/**
 * What parsing found in a document, kept on the source so it isn't parsed
 * again to answer it. Uploads have no topic: they never change.
 */
export const sourceStructureSchema = z.object({
  images: z.number().int().nonnegative(),
  pages: z.number().int().nonnegative().nullable(),
  topic: z.enum(SOURCE_TOPICS).nullable(),
});

export type SourceStructure = z.infer<typeof sourceStructureSchema>;
