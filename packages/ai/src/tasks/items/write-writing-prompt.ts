import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import {
  type CallWait,
  type Reasoning,
  buildProviderOptions,
  chooseServiceTier,
} from "../../provider-options";
import { fillPromptLanguages } from "../_utils/prompt-language";
import { type WrittenTask } from "../research/blueprint-written-schema";
import taskPrompt from "./write-writing-prompt.prompt.md";

const defaultModel = "openai/gpt-6.1-terra";
const fallbackModels = ["anthropic/claude-opus-5.5"] as const;
const points = z.number().positive().nullable();

const schema = z.object({
  aspects: z.array(z.object({ criterionId: z.string(), description: z.string(), points })).min(1),
  assessedSkillIds: z.array(z.string()).min(1),
  context: z.string().nullable(),
  criteria: z.array(z.object({ id: z.string(), name: z.string(), points })).min(1),
  keyPoints: z.array(z.string()).min(1),
  question: z.string().min(1),
  sampleOutline: z.string(),
  title: z.string().min(1),
});

export type WritingPromptOutput = z.infer<typeof schema>;
export type WritingPromptInput = {
  board?: string;
  choices: { group: string; subject: string }[];
  drillSkillId: string | null;
  exam: string;
  language: string;
  skills: { id: string; name: string }[];
  subject: { name: string; topics: string[] } | null;
  task: WrittenTask;
  unit: "answer" | "drill";
  usedTitles: string[];
};

export async function writeWritingPrompt({
  analytics,
  appendedInstructions,
  input,
  model = defaultModel,
  reasoning,
  shared,
  useFallback = true,
  wait,
}: {
  analytics?: AiGenerationContext;
  /** Evals append a rule here to have this prompt key a question a board already set. */
  appendedInstructions?: string;
  input: WritingPromptInput;
  model?: string;
  reasoning?: Reasoning;
  shared: boolean;
  useFallback?: boolean;
  wait: CallWait;
}) {
  const systemPrompt = fillPromptLanguages({
    learnerLanguage: input.language,
    template: appendedInstructions ? `${taskPrompt}\n${appendedInstructions}` : taskPrompt,
  });

  const userPrompt = JSON.stringify(input);

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions: buildProviderOptions({
          fallbackModels,
          model,
          reasoning,
          serviceTier: chooseServiceTier({ wait }),
          useFallback,
        }),
      }),
    libraryInput: shared,
    systemPrompt,
    task: "write-writing-prompt",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
