import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import systemPrompt from "./work-field.prompt.md";
import { WORK_FIELDS } from "./work-fields";

/**
 * Luna and Flash Lite both sorted 12 of 12 on the work-field eval (27 Sep 2026); it runs in the
 * background, so the cheaper wins.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite"] as const;

const schema = z.object({ field: z.enum([...WORK_FIELDS, "none"]) });

export type WorkFieldResult = z.infer<typeof schema>;

type WorkFieldInput = {
  goal: string;
  purpose: "careerChange" | "work";
  /** For a career change, the job they have now. */
  role: string | null;
  tasks: string | null;
  /** For a career change, the job they want. */
  targetRole: string | null;
};

export type WorkFieldParams = WorkFieldInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
};

function buildUserPrompt({ goal, purpose, role, targetRole, tasks }: WorkFieldInput): string {
  return `
    PURPOSE: ${purpose}
    GOAL: ${goal}

${formatUntrustedInput({ ROLE: role ?? "", TARGET_ROLE: targetRole ?? "", TASKS: tasks ?? "" })}
  `;
}

/** `none` when the words name no job clearly enough. */
export async function classifyWorkField({
  analytics,
  model = defaultModel,
  reasoning,
  useFallback = true,
  ...input
}: WorkFieldParams) {
  const userPrompt = buildUserPrompt(input);
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
    task: "work-field",
  });

  const data: WorkFieldResult = result.output;

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
