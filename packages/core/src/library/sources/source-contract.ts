import { z } from "zod";

const BYTES_PER_MB = 1024 * 1024;

/** The 20 MB limit accommodates the lowest inline-file limit among the upload-reading models. */
const MAX_UPLOAD_SIZE_MB = 20;
export const MAX_SOURCE_UPLOAD_BYTES = MAX_UPLOAD_SIZE_MB * BYTES_PER_MB;

export const PAGE_BREAK = "\f";

export const MAX_PASTED_TEXT_LENGTH = 200_000;

export const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const PPTX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export const PDF_CONTENT_TYPE = "application/pdf";

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

export const reusePolicySchema = z.object({
  basis: z.string(),
  honorTakedowns: z.boolean(),
  pastQuestions: z.enum(["allowedWithCitation", "notAllowed", "unknown"]),
  termsUrl: z.string().nullable(),
});

export type ReusePolicy = z.infer<typeof reusePolicySchema>;

const SOURCE_TOPICS = ["exam", "regulation", "software", "syllabus"] as const;

export type SourceTopic = (typeof SOURCE_TOPICS)[number];

export const sourceStructureSchema = z.object({
  images: z.number().int().nonnegative(),
  pages: z.number().int().nonnegative().nullable(),
  topic: z.enum(SOURCE_TOPICS).nullable(),
});

export type SourceStructure = z.infer<typeof sourceStructureSchema>;
