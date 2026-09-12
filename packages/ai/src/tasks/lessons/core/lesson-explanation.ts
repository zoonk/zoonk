import "server-only";
import { type Reasoning, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type LearningContext, formatLearningContext } from "../../_utils/learning-context";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { appendLessonRichTextPrompt } from "../_utils/append-lesson-rich-text-prompt";
import baseSystemPrompt from "./lesson-explanation.prompt.md";

const defaultModel = "openai/gpt-5.5";
const fallbackModels = ["openai/gpt-5.6-sol", "anthropic/claude-sonnet-5"] as const;

const systemPrompt = appendLessonRichTextPrompt(baseSystemPrompt);

const anchorSchema = z.object({ text: z.string(), title: z.string().min(1) }).strict();

const explanationStepSchema = z.object({ text: z.string(), title: z.string().min(1) }).strict();

const schema = z
  .object({ anchor: anchorSchema, explanation: z.array(explanationStepSchema).min(1) })
  .strict();

/** Naming the intended capability first helps small models keep a contextual example from taking over the lesson. */
const generationSchema = schema.extend({
  teachingGoal: z
    .string()
    .describe(
      "The exact skill or idea the learner should gain from this one LESSON_TITLE and LESSON_DESCRIPTION. State the teaching goal, not the example's goal or the broader course goal.",
    ),
});

export type LessonExplanationSchema = z.infer<typeof schema>;

export type LessonExplanationParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  otherLessonTitles: string[];
  learningContext?: LearningContext;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};

export async function generateLessonExplanation({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  otherLessonTitles,
  learningContext,
  model = defaultModel,
  useFallback = true,
  reasoning,
}: LessonExplanationParams) {
  const promptLanguage = getPromptLanguageName({ language });

  const userPrompt = `
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    CHAPTER_TITLE: ${chapterTitle}
    COURSE_TITLE: ${courseTitle}
    LANGUAGE: ${promptLanguage}
    OTHER_EXPLANATION_LESSON_TITLES: ${otherLessonTitles.join(", ")}
    LEARNING_CONTEXT: ${formatLearningContext(learningContext)}
  `;

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { output, usage } = await generateText({
    instructions: systemPrompt,
    model,
    output: Output.object({ schema: generationSchema }),
    prompt: userPrompt,
    providerOptions,
    reasoning,
  });

  return {
    data: { anchor: output.anchor, explanation: output.explanation },
    systemPrompt,
    usage,
    userPrompt,
  };
}
