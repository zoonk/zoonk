import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./course-intent.prompt.md";

/**
 * From the course-intent eval (175 cases, code-scored): Gemini 3.5 Flash Lite got every intent
 * right (1.7s p50, 2.0s p95), Luna 174 of 175 (1.6s, 2.7s p95); Flash Lite runs on a provider we
 * hold credits for, and onboarding waits on the slower of this and the goal's understanding.
 * Claude Haiku 5.5 with thinking off got 39 of 40 sampled cases at the same speed and $0.10 per
 * 1,000 runs against $0.74 (7 Oct 2026); Flash Lite got all 40, so it stays.
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
  /** The gateway tier it answers at (see `chooseServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
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
