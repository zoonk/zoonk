import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import officialPrompt from "./cite-material-official.prompt.md";
import ownMaterialPrompt from "./cite-material-own-material.prompt.md";
import basePrompt from "./cite-material.prompt.md";

/** Luna cited every screen right on the cite-material eval at the lower cost (8 Oct 2026). */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite", "anthropic/claude-haiku-5.5"] as const;

const schema = z.object({
  citations: z.array(z.object({ ref: z.string().nullable(), screen: z.number().int() })),
});

export type ScreenMaterialRef = z.infer<typeof schema>["citations"][number];

/** A lesson cites one kind, never both. */
export type CitedDocuments = "material" | "sources";

export type CiteMaterialInput = { documents: CitedDocuments; material: string; screens: string[] };

export type CiteMaterialParams = CiteMaterialInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  /** `flex`, since citations follow a published lesson. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
};

const SYSTEM_PROMPTS: Record<CitedDocuments, string> = {
  material: `${basePrompt}\n${ownMaterialPrompt}`,
  sources: `${basePrompt}\n${officialPrompt}`,
};

function formatScreens(screens: readonly string[]): string {
  return screens.map((screen, index) => `${index + 1}. ${screen}`).join("\n");
}

/** Null for a screen no page supports. Code keeps only references to pages the lesson was given. */
export async function citeMaterial({
  analytics,
  documents,
  material,
  model = defaultModel,
  reasoning,
  screens,
  serviceTier,
  useFallback = true,
}: CiteMaterialParams) {
  const systemPrompt = SYSTEM_PROMPTS[documents];
  const userPrompt = formatUntrustedInput({ MATERIAL: material, SCREENS: formatScreens(screens) });
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
    task: "cite-material",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
