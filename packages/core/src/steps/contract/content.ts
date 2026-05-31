import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";
import {
  type FillBlankStepContent,
  type MatchColumnsStepContent,
  type MultipleChoiceStepContent,
  type SelectImageStepContent,
  type SortOrderStepContent,
  fillBlankContentSchema,
  matchColumnsContentSchema,
  multipleChoiceContentSchema,
  selectImageContentSchema,
  sortOrderContentSchema,
} from "./exercise";
import { type StaticStepContent, staticContentSchema } from "./static";

export type { LessonKind } from "@zoonk/db";
export type {
  FillBlankStepContent,
  MatchColumnsStepContent,
  MultipleChoiceStepContent,
  SelectImageStepContent,
  SortOrderStepContent,
} from "./exercise";

const alphabetFormSchema = z.object({ label: z.string(), symbol: z.string() }).strict();

const alphabetContentSchema = z
  .object({
    audioText: z.string(),
    audioUrl: z.string().nullable(),
    forms: z.array(alphabetFormSchema),
    pronunciation: z.string(),
    readingAid: z.string(),
    symbol: z.string(),
  })
  .strict();

const vocabularyContentSchema = z.object({}).strict();
const translationContentSchema = z.object({}).strict();
const readingContentSchema = z.object({}).strict();
const listeningContentSchema = z.object({}).strict();

const stepContentSchemas = {
  alphabet: alphabetContentSchema,
  fillBlank: fillBlankContentSchema,
  listening: listeningContentSchema,
  matchColumns: matchColumnsContentSchema,
  multipleChoice: multipleChoiceContentSchema,
  reading: readingContentSchema,
  selectImage: selectImageContentSchema,
  sortOrder: sortOrderContentSchema,
  static: staticContentSchema,
  translation: translationContentSchema,
  vocabulary: vocabularyContentSchema,
} as const;

const malformedJsonBackslashEscape = "\u00005c";
const postgresUnsupportedNullCharacter = "\u0000";

export type SupportedStepKind = keyof typeof stepContentSchemas;

type AlphabetStepContent = z.infer<typeof alphabetContentSchema>;
type VocabularyStepContent = z.infer<typeof vocabularyContentSchema>;
type TranslationStepContent = z.infer<typeof translationContentSchema>;
type ReadingStepContent = z.infer<typeof readingContentSchema>;
type ListeningStepContent = z.infer<typeof listeningContentSchema>;

export type StepContentByKind = {
  alphabet: AlphabetStepContent;
  fillBlank: FillBlankStepContent;
  listening: ListeningStepContent;
  matchColumns: MatchColumnsStepContent;
  multipleChoice: MultipleChoiceStepContent;
  reading: ReadingStepContent;
  selectImage: SelectImageStepContent;
  sortOrder: SortOrderStepContent;
  static: StaticStepContent;
  translation: TranslationStepContent;
  vocabulary: VocabularyStepContent;
};

export function isSupportedStepKind(kind: string): kind is SupportedStepKind {
  return Object.hasOwn(stepContentSchemas, kind);
}

/**
 * Repairs malformed JSON escapes that models sometimes emit when they meant a
 * literal backslash for LaTeX, then removes any remaining NULs because
 * PostgreSQL JSONB cannot store U+0000 inside text values.
 */
function normalizeStepContentString(value: string): string {
  return value
    .replaceAll(malformedJsonBackslashEscape, "\\")
    .replaceAll(postgresUnsupportedNullCharacter, "");
}

/**
 * Normalizes one object entry while keeping object keys untouched because only
 * generated string values need this database-safe repair.
 */
function normalizeStepContentEntry([key, value]: [string, unknown]): [string, unknown] {
  return [key, normalizeStepContentValue(value)];
}

/**
 * Recurses through array content so nested options, pairs, forms, and image
 * prompts follow the same JSONB-safe string contract as top-level fields.
 */
function normalizeStepContentArray(value: unknown[]): unknown[] {
  return value.map((item) => normalizeStepContentValue(item));
}

/**
 * Recurses through parsed step-content objects without mutating the Zod output
 * object, which keeps validation and normalization as separate operations.
 */
function normalizeStepContentObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map((entry) => normalizeStepContentEntry(entry)));
}

/**
 * Walks validated step content and repairs only string leaves. Non-string JSON
 * values are already safe for Postgres and should pass through unchanged.
 */
function normalizeStepContentValue(value: unknown): unknown {
  if (typeof value === "string") {
    return normalizeStepContentString(value);
  }

  if (Array.isArray(value)) {
    return normalizeStepContentArray(value);
  }

  if (isJsonObject(value)) {
    return normalizeStepContentObject(value);
  }

  return value;
}

export function parseStepContent(kind: "alphabet", content: unknown): AlphabetStepContent;
export function parseStepContent(kind: "fillBlank", content: unknown): FillBlankStepContent;
export function parseStepContent(kind: "listening", content: unknown): ListeningStepContent;
export function parseStepContent(kind: "matchColumns", content: unknown): MatchColumnsStepContent;
export function parseStepContent(
  kind: "multipleChoice",
  content: unknown,
): MultipleChoiceStepContent;
export function parseStepContent(kind: "reading", content: unknown): ReadingStepContent;
export function parseStepContent(kind: "selectImage", content: unknown): SelectImageStepContent;
export function parseStepContent(kind: "sortOrder", content: unknown): SortOrderStepContent;
export function parseStepContent(kind: "static", content: unknown): StaticStepContent;
export function parseStepContent(kind: "translation", content: unknown): TranslationStepContent;
export function parseStepContent(kind: "vocabulary", content: unknown): VocabularyStepContent;
export function parseStepContent(
  kind: SupportedStepKind,
  content: unknown,
): StepContentByKind[SupportedStepKind];
export function parseStepContent(kind: SupportedStepKind, content: unknown) {
  return normalizeStepContentValue(stepContentSchemas[kind].parse(content));
}

export function assertStepContent(kind: "alphabet", content: unknown): AlphabetStepContent;
export function assertStepContent(kind: "fillBlank", content: unknown): FillBlankStepContent;
export function assertStepContent(kind: "listening", content: unknown): ListeningStepContent;
export function assertStepContent(kind: "matchColumns", content: unknown): MatchColumnsStepContent;
export function assertStepContent(
  kind: "multipleChoice",
  content: unknown,
): MultipleChoiceStepContent;
export function assertStepContent(kind: "reading", content: unknown): ReadingStepContent;
export function assertStepContent(kind: "selectImage", content: unknown): SelectImageStepContent;
export function assertStepContent(kind: "sortOrder", content: unknown): SortOrderStepContent;
export function assertStepContent(kind: "static", content: unknown): StaticStepContent;
export function assertStepContent(kind: "translation", content: unknown): TranslationStepContent;
export function assertStepContent(kind: "vocabulary", content: unknown): VocabularyStepContent;
export function assertStepContent(
  kind: SupportedStepKind,
  content: unknown,
): StepContentByKind[SupportedStepKind];
export function assertStepContent(kind: SupportedStepKind, content: unknown) {
  return parseStepContent(kind, content);
}
