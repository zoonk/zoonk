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
export type { StaticStepContent } from "./static";

const vocabularyContentSchema = z.object({}).strict();
const translationContentSchema = z.object({}).strict();
const readingContentSchema = z.object({}).strict();
const listeningContentSchema = z.object({}).strict();

const stepContentSchemas = {
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

export type SupportedStepKind = keyof typeof stepContentSchemas;

export type VocabularyStepContent = z.infer<typeof vocabularyContentSchema>;
export type TranslationStepContent = z.infer<typeof translationContentSchema>;
export type ReadingStepContent = z.infer<typeof readingContentSchema>;
export type ListeningStepContent = z.infer<typeof listeningContentSchema>;

export type StepContentByKind = {
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
  return stepContentSchemas[kind].parse(content);
}

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
