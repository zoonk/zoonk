import { z } from "zod";
import { type VisualStepContent, visualStepContentSchema } from "./visual-content-contract";

export type { ActivityKind } from "@zoonk/db";

const coreOptionSchema = z
  .object({
    feedback: z.string(),
    isCorrect: z.boolean(),
    text: z.string(),
  })
  .strict();

const coreMultipleChoiceContentSchema = z
  .object({
    context: z.string().optional(),
    kind: z.literal("core"),
    options: z.array(coreOptionSchema).min(1),
    question: z.string().optional(),
  })
  .strict();

export const multipleChoiceContentSchema = coreMultipleChoiceContentSchema;

const fillBlankChoiceSchema = z.string();

export const fillBlankContentSchema = z
  .object({
    answers: z.array(fillBlankChoiceSchema).min(1),
    distractors: z.array(fillBlankChoiceSchema),
    feedback: z.string(),
    question: z.string().optional(),
    romanizations: z.record(z.string(), z.string()).nullable().optional(),
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

const staticTextContentSchema = z
  .object({
    text: z.string(),
    title: z.string(),
    variant: z.literal("text"),
  })
  .strict();

const staticGrammarExampleContentSchema = z
  .object({
    highlight: z.string(),
    romanization: z.string().min(1).nullable(),
    sentence: z.string(),
    translation: z.string(),
    variant: z.literal("grammarExample"),
  })
  .strict();

const staticGrammarRuleContentSchema = z
  .object({
    ruleName: z.string(),
    ruleSummary: z.string(),
    variant: z.literal("grammarRule"),
  })
  .strict();

const storyMetricSchema = z
  .object({
    id: z.string(),
    initial: z.number(),
    label: z.string(),
  })
  .strict();

const storyOutcomeSchema = z
  .object({
    minStrongChoices: z.number().int().min(0),
    narrative: z.string(),
    title: z.string(),
  })
  .strict();

const storyDebriefConceptSchema = z
  .object({
    explanation: z.string(),
    name: z.string(),
  })
  .strict();

/**
 * Intro screen for a story activity (static step, first position).
 * Sets the scene and defines the metrics the player will track.
 */
const staticStoryIntroContentSchema = z
  .object({
    intro: z.string(),
    metrics: z.array(storyMetricSchema).min(1),
    variant: z.literal("storyIntro"),
  })
  .strict();

/**
 * Debrief screen for a story activity (static step, last position).
 * Reveals hidden concepts and shows outcome based on player's choices.
 */
const staticStoryDebriefContentSchema = z
  .object({
    debrief: z.array(storyDebriefConceptSchema).min(1),
    outcomes: z.array(storyOutcomeSchema).min(1),
    variant: z.literal("storyDebrief"),
  })
  .strict();

const staticContentSchema = z.discriminatedUnion("variant", [
  staticTextContentSchema,
  staticGrammarExampleContentSchema,
  staticGrammarRuleContentSchema,
  staticStoryIntroContentSchema,
  staticStoryDebriefContentSchema,
]);

const storyAlignmentSchema = z.enum(["strong", "partial", "weak"]);

const storyChoiceSchema = z
  .object({
    alignment: storyAlignmentSchema,
    consequence: z.string(),
    id: z.string(),
    metricChanges: z.record(z.string(), z.number()),
    text: z.string(),
  })
  .strict();

/** Schema for a story decision step's content (situation + choices). */
const storyContentSchema = z
  .object({
    choices: z.array(storyChoiceSchema).min(2),
    situation: z.string(),
  })
  .strict();

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
  story: storyContentSchema,
  translation: translationContentSchema,
  visual: visualStepContentSchema,
  vocabulary: vocabularyContentSchema,
} as const;

export type SupportedStepKind = keyof typeof stepContentSchemas;

export type CoreMultipleChoiceContent = z.infer<typeof coreMultipleChoiceContentSchema>;

export type MultipleChoiceStepContent = z.infer<typeof multipleChoiceContentSchema>;
export type FillBlankStepContent = z.infer<typeof fillBlankContentSchema>;
export type MatchColumnsStepContent = z.infer<typeof matchColumnsContentSchema>;
export type SortOrderStepContent = z.infer<typeof sortOrderContentSchema>;
export type SelectImageStepContent = z.infer<typeof selectImageContentSchema>;
export type StaticStepContent = z.infer<typeof staticContentSchema>;
export type StoryAlignment = z.infer<typeof storyAlignmentSchema>;
export type StoryStepContent = z.infer<typeof storyContentSchema>;
export type VocabularyStepContent = z.infer<typeof vocabularyContentSchema>;
export type TranslationStepContent = z.infer<typeof translationContentSchema>;
export type ReadingStepContent = z.infer<typeof readingContentSchema>;
export type ListeningStepContent = z.infer<typeof listeningContentSchema>;

export type { VisualStepContent };

export type StepContentByKind = {
  fillBlank: FillBlankStepContent;
  listening: ListeningStepContent;
  matchColumns: MatchColumnsStepContent;
  multipleChoice: MultipleChoiceStepContent;
  reading: ReadingStepContent;
  selectImage: SelectImageStepContent;
  sortOrder: SortOrderStepContent;
  static: StaticStepContent;
  story: StoryStepContent;
  translation: TranslationStepContent;
  visual: VisualStepContent;
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
export function parseStepContent(kind: "story", content: unknown): StoryStepContent;
export function parseStepContent(kind: "translation", content: unknown): TranslationStepContent;
export function parseStepContent(kind: "visual", content: unknown): VisualStepContent;
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
export function assertStepContent(kind: "story", content: unknown): StoryStepContent;
export function assertStepContent(kind: "translation", content: unknown): TranslationStepContent;
export function assertStepContent(kind: "visual", content: unknown): VisualStepContent;
export function assertStepContent(kind: "vocabulary", content: unknown): VocabularyStepContent;
export function assertStepContent(
  kind: SupportedStepKind,
  content: unknown,
): StepContentByKind[SupportedStepKind];
export function assertStepContent(kind: SupportedStepKind, content: unknown) {
  return parseStepContent(kind, content);
}
