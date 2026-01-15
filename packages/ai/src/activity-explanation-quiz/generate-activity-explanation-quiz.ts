import "server-only";

import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import systemPrompt from "./activity-explanation-quiz.prompt.md";
import arrangeWordsPrompt from "./tools/arrange-words.prompt.md";
import fillBlankPrompt from "./tools/fill-blank.prompt.md";
import matchColumnsPrompt from "./tools/match-columns.prompt.md";
import multipleChoicePrompt from "./tools/multiple-choice.prompt.md";
import selectImagePrompt from "./tools/select-image.prompt.md";
import sortOrderPrompt from "./tools/sort-order.prompt.md";

const DEFAULT_MODEL =
  process.env.AI_MODEL_ACTIVITY_EXPLANATION_QUIZ ?? "openai/gpt-5.2";

const FALLBACK_MODELS = [
  "anthropic/claude-opus-4.5",
  "openai/gpt-5.1-instant",
  "google/gemini-3-flash",
  "xai/grok-4.1-fast-reasoning",
  "google/gemini-3-pro-preview",
];

// Shared schemas
const contextKindSchema = z.enum([
  "text",
  "code",
  "image",
  "table",
  "chart",
  "diagram",
  "timeline",
  "quote",
]);

const contextSchema = z.object({
  description: z
    .string()
    .describe(
      "For text: the actual scenario (max 300 chars). For visual kinds: describe what to generate.",
    ),
  kind: contextKindSchema.describe(
    "Use 'text' for most questions. Other kinds only when visual analysis is essential.",
  ),
});

// Tool input schemas
const multipleChoiceInputSchema = z.object({
  context: contextSchema,
  options: z
    .array(
      z.object({
        feedback: z
          .string()
          .describe(
            "Why this is right (with insight) or wrong (and why correct is right)",
          ),
        isCorrect: z.boolean(),
        text: z.string().describe("The answer choice"),
      }),
    )
    .describe("Exactly 4 options: 1 correct, 3 plausible distractors"),
  question: z
    .string()
    .describe("Short question about the context (max 50 chars)"),
});

const matchColumnsInputSchema = z.object({
  pairs: z
    .array(
      z.object({
        left: z.string().describe("Real-world item, scenario, or phenomenon"),
        right: z
          .string()
          .describe("The concept, principle, or outcome it connects to"),
      }),
    )
    .describe("3-5 pairs to match"),
  question: z.string().describe("Context for the matching task"),
});

const fillBlankInputSchema = z.object({
  answers: z
    .array(z.string())
    .describe("Correct words in order (position 0 fills first blank)"),
  distractors: z
    .array(z.string())
    .describe("Plausible but incorrect words to include as options"),
  feedback: z
    .string()
    .describe("Explanation of why these concepts belong in these positions"),
  question: z.string().describe("Context for the fill-in-the-blank exercise"),
  template: z
    .string()
    .describe("Sentence(s) with [BLANK] placeholders - use exactly [BLANK]"),
});

const sortOrderInputSchema = z.object({
  feedback: z.string().describe("Explanation of why this sequence is correct"),
  items: z.array(z.string()).describe("Items in the CORRECT order (4-6 items)"),
  question: z.string().describe("What needs to be ordered and why it matters"),
});

const arrangeWordsInputSchema = z.object({
  distractors: z
    .array(z.string())
    .describe("Plausible but incorrect words in the target language only"),
  feedback: z
    .string()
    .describe("Explanation of why this arrangement is correct"),
  question: z
    .string()
    .describe(
      "Contextual question requiring understanding to answer (NOT just 'arrange these words')",
    ),
  words: z
    .array(z.string())
    .describe(
      "Words in the CORRECT order. Each must be a single word in the target language — no mixed scripts",
    ),
});

const selectImageInputSchema = z.object({
  options: z
    .array(
      z.object({
        feedback: z
          .string()
          .describe("Why this image does/doesn't represent the concept"),
        isCorrect: z.boolean(),
        prompt: z
          .string()
          .describe(
            "Image generation prompt describing what to show (not style, just content)",
          ),
      }),
    )
    .describe("2-4 image options"),
  question: z
    .string()
    .describe(
      "A scenario where visual identification demonstrates understanding",
    ),
});

// Output types
type MultipleChoiceQuestion = z.infer<typeof multipleChoiceInputSchema> & {
  format: "multipleChoice";
};
type MatchColumnsQuestion = z.infer<typeof matchColumnsInputSchema> & {
  format: "matchColumns";
};
type FillBlankQuestion = z.infer<typeof fillBlankInputSchema> & {
  format: "fillBlank";
};
type SortOrderQuestion = z.infer<typeof sortOrderInputSchema> & {
  format: "sortOrder";
};
type ArrangeWordsQuestion = z.infer<typeof arrangeWordsInputSchema> & {
  format: "arrangeWords";
};
type SelectImageQuestion = z.infer<typeof selectImageInputSchema> & {
  format: "selectImage";
};

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
