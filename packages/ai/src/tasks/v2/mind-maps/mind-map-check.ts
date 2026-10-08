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
 * Tried on seven maps with known mistakes (7 Oct 2026): Haiku 5.5 with thinking off read every
 * misspelling ("altenpada", "mudia") and sketch caption back as written, in about 7 seconds for
 * $0.001; Gemini 3.8 Flash and Luna read them too, at 14 and 22 seconds. It reads a 1024-pixel map
 * for about $0.0004. The check runs after the map is shown, so it asks for flex, which applies when
 * a fallback answers (Anthropic has no flex tier through the gateway).
 */
const defaultModel = "anthropic/claude-haiku-5.5";
const defaultReasoning: Reasoning = "none";
const fallbackModels = ["google/gemini-3.8-flash", "openai/gpt-6-luna"] as const;

const schema = z.object({ lines: z.array(z.string()) });

/** A list of problems short enough for a model to read as corrections. */
const MAX_LISTED_WORDS = 12;

type MindMapCheckVerdict = {
  /** Words of the map the picture seems to leave out. */
  missing: string[];
  passed: boolean;
  /** What went wrong, quoting the words, for the next drawing's corrections. */
  problems: string[];
  transcript: string[];
  /** Words on the picture that aren't the map's: misspelled, garbled or extra. */
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
 * The check after a mind map's picture is shown: a vision model reads every word on it as
 * written, and the words are compared with the map's text in code, accents included. It fails
 * only on a serious problem (several wrong words, or a part left out), and then the problems
 * quote the words, so the next drawing can fix them.
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
