import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type CallWait, buildProviderOptions, chooseServiceTier } from "../../provider-options";
import systemPrompt from "./icon-match.prompt.md";
import { type IconNeed } from "./icon-need";

const defaultModel = "anthropic/claude-haiku-5.5";
const fallbackModels = ["openai/gpt-6-luna", "google/gemini-3.8-flash"] as const;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the need's number comes first. */
const schema = z.object({
  needs: z.array(z.object({ need: z.int(), reuse: z.string().nullable() })),
});
/* oxlint-enable eslint/sort-keys */

export type IconCandidate = { description: string; id: string; name: string; tags: string[] };

export type IconMatchNeed = { candidates: IconCandidate[]; need: IconNeed; usedFor: string };

export type IconMatchParams = {
  needs: IconMatchNeed[];
  analytics?: AiGenerationContext;
  model?: string;
  useFallback?: boolean;
  wait?: CallWait;
};

function formatNeed({ candidates, need, usedFor }: IconMatchNeed, index: number): string {
  const library = candidates.map(
    (icon) =>
      `  ${icon.id}: ${icon.name}; tags: ${icon.tags.join(", ")}; shows: ${icon.description}`,
  );

  return [
    `NEED ${index + 1}: "${need.name}" (also: ${need.searchWords.join(", ")}). Shows: ${need.description}`,
    `USED FOR: ${usedFor}`,
    `LIBRARY:\n${library.join("\n")}`,
  ].join("\n");
}

/** In the order of `needs`: a library icon's id, only one of that need's own candidates, or null. */
export async function matchLessonIcons({
  analytics,
  model = defaultModel,
  needs,
  useFallback = true,
  wait = "soon",
}: IconMatchParams) {
  const userPrompt = needs.map((need, index) => formatNeed(need, index)).join("\n\n");

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    serviceTier: chooseServiceTier({ wait }),
    useFallback,
  });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
      }),
    libraryInput: true,
    systemPrompt,
    task: "icon-match",
  });

  const answers = new Map(result.output.needs.map((answer) => [answer.need, answer.reuse]));

  const data = needs.map(({ candidates }, index) => {
    const reuse = answers.get(index + 1);
    return candidates.some((icon) => icon.id === reuse) ? (reuse ?? null) : null;
  });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
