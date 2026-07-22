import "server-only";
import { type Reasoning, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { insertLessonFeedbackPrompt } from "../_utils/append-lesson-feedback-prompt";
import { appendLessonRichTextPrompt } from "../_utils/append-lesson-rich-text-prompt";
import { type SourceLesson, formatSourceLessonForPrompt } from "../_utils/source-lessons";
import { normalizePracticeOptions, practiceOptionLimit } from "./_utils/normalize-practice-options";
import baseSystemPrompt from "./lesson-practice.prompt.md";

const defaultModel = "openai/gpt-5.6-sol";
const fallbackModels = ["anthropic/claude-sonnet-5", "openai/gpt-5.6-sol"] as const;
const systemPrompt = insertLessonFeedbackPrompt(appendLessonRichTextPrompt(baseSystemPrompt));

const practiceOptionSchema = z.object({
  feedback: z.string(),
  isCorrect: z.boolean(),
  text: z.string(),
});

const normalizedPracticeOptionSchema = practiceOptionSchema.extend({
  feedback: z.string().trim().min(1),
  text: z.string().trim().min(1),
});

const practiceSituationSchema = z.object({
  dialogue: z.string(),
  imagePrompt: z.string(),
  options: z.array(practiceOptionSchema).min(1),
  question: z.string(),
});

/**
 * Practice questions are only safe to publish when one visible answer is
 * marked correct. Normalization can remove duplicate correct copies, but it
 * must not guess between distinct answers that the model marked as correct.
 */
function hasExactlyOneCorrectOption(situation: z.infer<typeof practiceSituationSchema>): boolean {
  return situation.options.filter((option) => option.isCorrect).length === 1;
}

const generatedPracticeSchema = z.object({ situations: z.array(practiceSituationSchema).min(1) });

const normalizedPracticeSituationSchema = practiceSituationSchema
  .extend({ options: z.array(normalizedPracticeOptionSchema).length(practiceOptionLimit) })
  .refine(hasExactlyOneCorrectOption, {
    message: "Practice situations must have exactly one correct option",
    path: ["options"],
  });

const normalizedPracticeSchema = z.object({
  situations: z.array(normalizedPracticeSituationSchema).min(1),
});

export type LessonPracticeSchema = z.infer<typeof normalizedPracticeSchema>;

export type LessonPracticeParams = {
  chapterTitle: string;
  courseTitle: string;
  language: string;
  lesson: SourceLesson;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};

/**
 * Repairs structurally usable model output before enforcing the practice
 * contract. This lets blank, repeated, or extra distractors be removed without
 * failing the whole lesson while still rejecting questions that remain unsafe.
 */
function normalizePracticeOutput(
  output: z.infer<typeof generatedPracticeSchema>,
): LessonPracticeSchema {
  return normalizedPracticeSchema.parse({
    situations: output.situations.map((situation) => ({
      ...situation,
      options: normalizePracticeOptions(situation.options),
    })),
  });
}

export async function generateLessonPractice({
  chapterTitle,
  courseTitle,
  language,
  lesson,
  model = defaultModel,
  useFallback = true,
  reasoning,
}: LessonPracticeParams) {
  const formattedLesson = formatSourceLessonForPrompt(lesson);
  const promptLanguage = getPromptLanguageName({ language });

  const userPrompt = `
    CHAPTER_TITLE: ${chapterTitle}
    COURSE_TITLE: ${courseTitle}
    LANGUAGE: ${promptLanguage}
    LESSON: ${formattedLesson}
  `;

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { output, usage } = await generateText({
    instructions: systemPrompt,
    model,
    output: Output.object({ schema: generatedPracticeSchema }),
    prompt: userPrompt,
    providerOptions,
    reasoning,
  });

  return { data: normalizePracticeOutput(output), systemPrompt, usage, userPrompt };
}
