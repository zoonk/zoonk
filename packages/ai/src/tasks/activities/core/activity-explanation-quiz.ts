import "server-only";

import { generateText, stepCountIs, tool } from "ai";

import { arrangeWordsInputSchema } from "../_tools/arrange-words";
import arrangeWordsPrompt from "../_tools/arrange-words.prompt.md";
import { fillBlankInputSchema } from "../_tools/fill-blank";
import fillBlankPrompt from "../_tools/fill-blank.prompt.md";
import { matchColumnsInputSchema } from "../_tools/match-columns";
import matchColumnsPrompt from "../_tools/match-columns.prompt.md";
import { multipleChoiceInputSchema } from "../_tools/multiple-choice";
import multipleChoicePrompt from "../_tools/multiple-choice.prompt.md";
import { selectImageInputSchema } from "../_tools/select-image";
import selectImagePrompt from "../_tools/select-image.prompt.md";
import { sortOrderInputSchema } from "../_tools/sort-order";
import sortOrderPrompt from "../_tools/sort-order.prompt.md";
import systemPrompt from "./activity-explanation-quiz.prompt.md";

const DEFAULT_MODEL =
  process.env.AI_MODEL_ACTIVITY_EXPLANATION_QUIZ ?? "openai/gpt-5.2";

const FALLBACK_MODELS = [
  "anthropic/claude-opus-4.5",
  "openai/gpt-5.1-instant",
  "google/gemini-3-flash",
  "xai/grok-4.1-fast-reasoning",
  "google/gemini-3-pro-preview",
];

// Output types
type MultipleChoiceQuestion = {
  format: "multipleChoice";
} & ReturnType<typeof multipleChoiceInputSchema.parse>;

type MatchColumnsQuestion = {
  format: "matchColumns";
} & ReturnType<typeof matchColumnsInputSchema.parse>;

type FillBlankQuestion = {
  format: "fillBlank";
} & ReturnType<typeof fillBlankInputSchema.parse>;

type SortOrderQuestion = {
  format: "sortOrder";
} & ReturnType<typeof sortOrderInputSchema.parse>;

type ArrangeWordsQuestion = {
  format: "arrangeWords";
} & ReturnType<typeof arrangeWordsInputSchema.parse>;

type SelectImageQuestion = {
  format: "selectImage";
} & ReturnType<typeof selectImageInputSchema.parse>;

export type ExplanationQuizQuestion =
  | MultipleChoiceQuestion
  | MatchColumnsQuestion
  | FillBlankQuestion
  | SortOrderQuestion
  | ArrangeWordsQuestion
  | SelectImageQuestion;

export type ActivityExplanationQuizSchema = {
  questions: ExplanationQuizQuestion[];
};

export type ActivityExplanationQuizParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  explanationSteps: Array<{ title: string; text: string }>;
  model?: string;
  useFallback?: boolean;
};

export async function generateActivityExplanationQuiz({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  explanationSteps,
  model = DEFAULT_MODEL,
  useFallback = true,
}: ActivityExplanationQuizParams) {
  const formattedExplanationSteps = explanationSteps
    .map((step, index) => `${index + 1}. ${step.title}: ${step.text}`)
    .join("\n");

  const userPrompt = `LESSON_TITLE: ${lessonTitle}
LESSON_DESCRIPTION: ${lessonDescription}
CHAPTER_TITLE: ${chapterTitle}
COURSE_TITLE: ${courseTitle}
LANGUAGE: ${language}
EXPLANATION_STEPS:
${formattedExplanationSteps}

Generate quiz questions that test understanding of these concepts. Use the available tools to create questions in appropriate formats. Aim for 4-8 questions covering the key concepts.`;

  const { steps, usage } = await generateText({
    model,
    prompt: userPrompt,
    providerOptions: {
      gateway: { models: useFallback ? FALLBACK_MODELS : [] },
    },
    stopWhen: stepCountIs(10),
    system: systemPrompt,
    toolChoice: "required",
    tools: {
      arrangeWords: tool({
        description: arrangeWordsPrompt,
        inputSchema: arrangeWordsInputSchema,
      }),
      fillBlank: tool({
        description: fillBlankPrompt,
        inputSchema: fillBlankInputSchema,
      }),
      matchColumns: tool({
        description: matchColumnsPrompt,
        inputSchema: matchColumnsInputSchema,
      }),
      multipleChoice: tool({
        description: multipleChoicePrompt,
        inputSchema: multipleChoiceInputSchema,
      }),
      selectImage: tool({
        description: selectImagePrompt,
        inputSchema: selectImageInputSchema,
      }),
      sortOrder: tool({
        description: sortOrderPrompt,
        inputSchema: sortOrderInputSchema,
      }),
    },
  });

  // Collect all tool calls as questions
  const questions = steps.flatMap((step) =>
    step.toolCalls
      .filter((call) => !call.dynamic)
      .map((call) => ({
        format: call.toolName as ExplanationQuizQuestion["format"],
        ...call.input,
      })),
  ) as ExplanationQuizQuestion[];

  return { data: { questions }, systemPrompt, usage, userPrompt };
}
