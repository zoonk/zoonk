import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./course-intent.prompt.md";

const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite"] as const;

const courseIntentSchema = z.enum(["unsafe", "exam", "question", "learn", "ambiguous"]);

const schema = z.object({ intent: courseIntentSchema });

export type CourseIntent = z.infer<typeof courseIntentSchema>;
export type CourseIntentSchema = z.infer<typeof schema>;

export type CourseIntentParams = {
  prompt: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/**
 * Classifies the learner's product intent. Onboarding runs it beside the goal
 * understanding so a goal it marks unsafe is declined whatever route the
 * understanding picked.
 */
export async function classifyCourseIntent({
  analytics,
  model = defaultModel,
  prompt,
  reasoning,
  useFallback = true,
}: CourseIntentParams) {
  const userPrompt = `
    USER_INPUT: ${prompt}
  `;

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "course-intent",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}

/**
 * The same rules as an evaluation question, so the eval can compare Jev and other evaluation
 * models with the generation model on the same labels.
 */
export const courseIntentClassifier = {
  instructions: systemPrompt,
  labels: {
    ambiguous:
      "Asks for a deliverable, advice or a personal change, or the subject is unclear (see Ambiguous).",
    exam: "Targets a school test, entrance exam, certification, license or other qualification.",
    learn: "Asks to learn, study or practice, or names a recognizable subject or skill.",
    question: "Asks for an explanation of how, why or what something works or means.",
    unsafe: "A harmful goal or a topic the app prohibits (see Unsafe).",
  } satisfies Record<CourseIntent, string>,
  toInput: ({ prompt }: { prompt: string }) => ({ USER_INPUT: prompt }),
};
