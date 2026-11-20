import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type CallWait, buildProviderOptions, chooseServiceTier } from "../../provider-options";
import { fillPromptLanguages } from "../_utils/prompt-language";
import taskPrompt from "./write-writing-prompt.prompt.md";

const model = "openai/gpt-6.1-terra";
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
  drillSkillId: string | null;
  language: string;
  skills: { id: string; name: string }[];
  task: { description: string; key: string; lines: number | null; points: number | null };
  unit: "answer" | "drill";
  usedTitles: string[];
};

export async function writeWritingPrompt({
  analytics,
  input,
  shared,
  wait,
}: {
  analytics?: AiGenerationContext;
  input: WritingPromptInput;
  shared: boolean;
  wait: CallWait;
}) {
  const systemPrompt = fillPromptLanguages({
    learnerLanguage: input.language,
    template: taskPrompt,
  });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: JSON.stringify(input),
        providerOptions: buildProviderOptions({
          fallbackModels,
          model,
          serviceTier: chooseServiceTier({ wait }),
          useFallback: true,
        }),
      }),
    libraryInput: shared,
    systemPrompt,
    task: "write-writing-prompt",
  });

  return { data: result.output, provenance };
}
