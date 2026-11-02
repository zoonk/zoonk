import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./course-intent.prompt.md";

/**
 * Flash Lite got all 175 course-intent cases right (1.7s p50); Luna and Claude Haiku 5.5 each
 * missed one (7 Oct 2026).
 */
const defaultModel = "google/gemini-3.5-flash-lite";
const fallbackModels = ["openai/gpt-6-luna"] as const;

const courseIntentSchema = z.enum(["unsafe", "exam", "question", "learn", "ambiguous"]);

const schema = z.object({ intent: courseIntentSchema });

export type CourseIntent = z.infer<typeof courseIntentSchema>;
export type CourseIntentSchema = z.infer<typeof schema>;

export type CourseIntentParams = {
  prompt: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  serviceTier?: ServiceTier;
  analytics?: AiGenerationContext;
};

export async function classifyCourseIntent({
  analytics,
  model = defaultModel,
  prompt,
  reasoning,
  serviceTier,
  useFallback = true,
}: CourseIntentParams) {
  const userPrompt = `
    USER_INPUT: ${prompt}
  `;

  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

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

/** So the eval can compare evaluation models with the generation model on the same labels. */
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
