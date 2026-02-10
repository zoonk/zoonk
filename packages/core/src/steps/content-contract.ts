import { type StepKind } from "@zoonk/db";
import { z } from "zod";

const challengeEffectSchema = z
  .object({
    dimension: z.string(),
    impact: z.enum(["positive", "neutral", "negative"]),
  })
  .strict();

const multipleChoiceOptionSchema = z
  .object({
    consequence: z.string().optional(),
    effects: z.array(challengeEffectSchema).optional(),
    feedback: z.string().optional(),
    isCorrect: z.boolean().optional(),
    text: z.string(),
    textRomanization: z.string().optional(),
  })
  .strict();

export const multipleChoiceContentSchema = z
  .object({
    context: z.string().optional(),
    contextRomanization: z.string().optional(),
    contextTranslation: z.string().optional(),
    options: z.array(multipleChoiceOptionSchema).min(1),
    question: z.string().optional(),
  })
  .strict();

const fillBlankChoiceSchema = z.string();

export const fillBlankContentSchema = z
  .object({
    answers: z.array(fillBlankChoiceSchema).min(1),
    distractors: z.array(fillBlankChoiceSchema),
    feedback: z.string(),
    question: z.string().optional(),
    template: z.string(),
  })
  .strict();

const matchColumnsPairSchema = z
  .object({
    left: z.string(),
    right: z.string(),
  })
  .strict();

export const matchColumnsContentSchema = z
  .object({
    pairs: z.array(matchColumnsPairSchema).min(1),
    question: z.string(),
  })
  .strict();

export const sortOrderContentSchema = z
  .object({
    feedback: z.string(),
    items: z.array(z.string()).min(1),
    question: z.string(),
  })
  .strict();

const selectImageOptionSchema = z
  .object({
    feedback: z.string(),
    isCorrect: z.boolean(),
    prompt: z.string(),
    url: z.string().optional(),
  })
  .strict();

export const selectImageContentSchema = z
  .object({
    options: z.array(selectImageOptionSchema).min(1),
    question: z.string(),
  })
  .strict();

export const staticTextContentSchema = z
  .object({
    text: z.string(),
    title: z.string(),
    variant: z.literal("text"),
  })
  .strict();

export const staticGrammarExampleContentSchema = z
  .object({
    highlight: z.string(),
    romanization: z.string(),
    sentence: z.string(),
    translation: z.string(),
    variant: z.literal("grammarExample"),
  })
  .strict();

export const staticGrammarRuleContentSchema = z
  .object({
    ruleName: z.string(),
    ruleSummary: z.string(),
    variant: z.literal("grammarRule"),
  })
  .strict();

export const staticContentSchema = z.discriminatedUnion("variant", [
  staticTextContentSchema,
  staticGrammarExampleContentSchema,
  staticGrammarRuleContentSchema,
]);

export const vocabularyContentSchema = z.object({}).strict();
export const readingContentSchema = z.object({}).strict();
export const listeningContentSchema = z.object({}).strict();

const stepContentSchemas = {
  fillBlank: fillBlankContentSchema,
  listening: listeningContentSchema,
  matchColumns: matchColumnsContentSchema,
  multipleChoice: multipleChoiceContentSchema,
  reading: readingContentSchema,
  selectImage: selectImageContentSchema,
  sortOrder: sortOrderContentSchema,
  static: staticContentSchema,
  vocabulary: vocabularyContentSchema,
} as const;

export type SupportedStepKind = keyof typeof stepContentSchemas;

export type MultipleChoiceStepContent = z.infer<typeof multipleChoiceContentSchema>;
export type FillBlankStepContent = z.infer<typeof fillBlankContentSchema>;
export type MatchColumnsStepContent = z.infer<typeof matchColumnsContentSchema>;
export type SortOrderStepContent = z.infer<typeof sortOrderContentSchema>;
export type SelectImageStepContent = z.infer<typeof selectImageContentSchema>;
export type StaticStepContent = z.infer<typeof staticContentSchema>;
export type VocabularyStepContent = z.infer<typeof vocabularyContentSchema>;
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
  vocabulary: VocabularyStepContent;
};

export function isSupportedStepKind(kind: StepKind): kind is SupportedStepKind {
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
export function assertStepContent(kind: "vocabulary", content: unknown): VocabularyStepContent;
export function assertStepContent(
  kind: SupportedStepKind,
  content: unknown,
): StepContentByKind[SupportedStepKind];
export function assertStepContent(kind: SupportedStepKind, content: unknown) {
  return parseStepContent(kind, content);
}
