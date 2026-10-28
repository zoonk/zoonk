import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions, chooseServiceTier } from "../../../provider-options";
import systemPrompt from "./mind-map-check.prompt.md";
import { type MindMapStructure, listMindMapTexts } from "./mind-map-schema";
import { compareMindMapText } from "./mind-map-text";

/**
 * Haiku 5.5 read every planted misspelling back as written in about 7 seconds, half Gemini 3.8
 * Flash's time (7 Oct 2026). The check runs after the map is shown, so it asks for flex, which
 * applies when a fallback answers: Anthropic has no flex tier through the gateway.
 */
const defaultModel = "anthropic/claude-haiku-5.5";
const defaultReasoning: Reasoning = "none";
const fallbackModels = ["google/gemini-3.8-flash", "openai/gpt-6-luna"] as const;

const schema = z.object({ lines: z.array(z.string()) });

/** A list of problems short enough for a model to read as corrections. */
const MAX_LISTED_WORDS = 12;

type MindMapCheckVerdict = {
  missing: string[];
  passed: boolean;
  /** Quoting the words, for the next drawing's corrections. */
  problems: string[];
  transcript: string[];
  /** Misspelled, garbled or extra. */
  unknown: string[];
};

export type MindMapCheckParams = {
  image: { data: Uint8Array; mediaType: string };
  structure: MindMapStructure;
  language: string;
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
};

function quote(words: readonly string[]): string {
  return words
    .slice(0, MAX_LISTED_WORDS)
    .map((word) => `'${word}'`)
    .join(", ");
}

function describeProblems({
  missing,
  unknown,
}: {
  missing: readonly string[];
  unknown: readonly string[];
}): string[] {
  return [
    unknown.length > 0 &&
      `words that aren't in the map's text (misspelled, garbled or extra): ${quote(unknown)}`,
    missing.length > 0 && `words of the map's text the picture leaves out: ${quote(missing)}`,
  ].filter((problem) => typeof problem === "string");
}

/**
 * A vision model reads every word as written and code compares them with the map's text. It fails
 * only on a serious problem (several wrong words, or a part left out).
 */
export async function checkMindMapImage({
  analytics,
  image,
  language,
  model = defaultModel,
  reasoning = defaultReasoning,
  structure,
  useFallback = true,
}: MindMapCheckParams) {
  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    serviceTier: chooseServiceTier({ wait: "later" }),
    useFallback,
  });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        messages: [
          {
            content: [{ data: image.data, mediaType: image.mediaType, type: "file" }],
            role: "user",
          },
        ],
        model,
        output: Output.object({ schema }),
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "mind-map-check",
  });

  const transcript = result.output.lines;

  const comparison = compareMindMapText({
    expected: listMindMapTexts({ language, structure }),
    transcript,
  });

  const data: MindMapCheckVerdict = {
    missing: comparison.missing,
    passed: comparison.passed,
    problems: describeProblems(comparison),
    transcript,
    unknown: comparison.unknown,
  };

  return { data, provenance };
}
