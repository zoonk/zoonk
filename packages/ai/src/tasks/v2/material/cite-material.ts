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

/**
 * From the cite-material eval (3 lessons in Portuguese and English, code scoring, 27 Sep 2026):
 * Luna and Gemini 3.5 Flash Lite cited every screen right (10.0 once an opening guess about a
 * slide's topic could cite it); Luna is the cheaper at $0.16 per 1,000 lessons. Told that a
 * learner's notes support a screen in any words (shorthand, another form of the word), Luna cited
 * all 6 cases right, a tonicity screen it had once left uncited from Pedro's notes included (8 Oct
 * 2026).
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite", "anthropic/claude-haiku-5.5"] as const;

const schema = z.object({
  citations: z.array(z.object({ ref: z.string().nullable(), screen: z.number().int() })),
});

export type ScreenMaterialRef = z.infer<typeof schema>["citations"][number];

/**
 * What a lesson was written from: the learner's own material (class slides, a handout, their
 * notes), or the official documents its facts come from (a law, an exam notice). A lesson cites
 * one kind, never both.
 */
export type CitedDocuments = "material" | "sources";

export type CiteMaterialInput = {
  documents: CitedDocuments;
  /** The pages the lesson was written from, tagged with their references. */
  material: string;
  /** Each screen's learner-facing text, in order. */
  screens: string[];
};

export type CiteMaterialParams = CiteMaterialInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  /** The gateway tier (see `chooseServiceTier`): `flex`, since citations follow a published lesson. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
};

/**
 * Each kind of document gets its own rule after the shared ones: when a learner's notes support a
 * screen, or when an official document does. A call never reads the other kind's rule.
 */
const SYSTEM_PROMPTS: Record<CitedDocuments, string> = {
  material: `${basePrompt}\n${ownMaterialPrompt}`,
  sources: `${basePrompt}\n${officialPrompt}`,
};

function formatScreens(screens: readonly string[]): string {
  return screens.map((screen, index) => `${index + 1}. ${screen}`).join("\n");
}

/**
 * Picks the page or passage each screen of a lesson teaches from, so every screen can cite it: the
 * learner's own material for a lesson built from it, or the official documents (a law, an exam
 * notice) a shared lesson's facts come from; null for a screen no page supports. Code keeps only
 * references to pages the lesson was given.
 */
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
