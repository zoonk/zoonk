import "server-only";
import { Output, generateText } from "ai";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { buildProviderOptions, chooseServiceTier } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import {
  type MindMapStructure,
  mindMapStructureSchema,
  normalizeMindMapStructure,
} from "./mind-map-schema";
import systemPrompt from "./mind-map-structure.prompt.md";

/**
 * Tried on four chapters (7 Oct 2026, two in Portuguese, one in English, one UX): Haiku 5.5 kept
 * closer to what the lessons say (their own examples and numbers) than Gemini 3.8 Flash, which
 * once wrote a fact no lesson had, at about $0.002 a map against $0.009, in 9 to 13 seconds.
 */
const defaultModel = "anthropic/claude-haiku-5.5";
const fallbackModels = ["google/gemini-3.8-flash", "openai/gpt-6-luna"] as const;

/** One lesson of the chapter as the map reads it: what it teaches, in its own words. */
export type MindMapLesson = {
  canDo: string | null;
  /** Its explanation and worked-example screens, titled when they have a title. */
  screens: { text: string; title: string | null }[];
  summary: string[];
  title: string;
};

export type MindMapChapter = {
  description: string;
  language: string;
  lessons: MindMapLesson[];
  objectives: string[];
  title: string;
};

export type MindMapStructureParams = {
  chapter: MindMapChapter;
  analytics?: AiGenerationContext;
  model?: string;
  useFallback?: boolean;
};

function formatLesson(lesson: MindMapLesson, index: number): string {
  const summary = lesson.summary.map((idea) => `  - ${idea}`).join("\n");

  const screens = lesson.screens
    .map((screen) => `  * ${screen.title ? `${screen.title}: ` : ""}${screen.text}`)
    .join("\n");

  return [
    `LESSON ${index + 1}: ${lesson.title}`,
    `CAN DO: ${lesson.canDo ?? ""}`,
    `SUMMARY:\n${summary}`,
    `SCREENS:\n${screens}`,
  ].join("\n");
}

function buildUserPrompt(chapter: MindMapChapter): string {
  return [
    `LANGUAGE: ${getPromptLanguageName({ language: chapter.language })}`,
    `CHAPTER: ${chapter.title}`,
    `DESCRIPTION: ${chapter.description}`,
    `OBJECTIVES: ${chapter.objectives.join("; ")}`,
    "",
    ...chapter.lessons.map((lesson, index) => formatLesson(lesson, index)),
  ].join("\n");
}

/**
 * Writes a chapter's mind map as text from what its lessons teach: the title in the middle, the
 * central idea, the branches with their explanation, points and a sketch to draw, an optional
 * comparison and a summary line. The picture is drawn from it (`generateMindMapImage`) and it is
 * the map itself for screen readers and when a picture fails its check. Throws when the answer
 * isn't a usable map, so the caller's retry writes it again.
 */
export async function generateMindMapStructure({
  analytics,
  chapter,
  model = defaultModel,
  useFallback = true,
}: MindMapStructureParams): Promise<{
  data: MindMapStructure;
  provenance: Awaited<ReturnType<typeof runTaskGeneration>>["provenance"];
  systemPrompt: string;
  userPrompt: string;
}> {
  const userPrompt = buildUserPrompt(chapter);

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    serviceTier: chooseServiceTier({ wait: "learner" }),
    useFallback,
  });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: mindMapStructureSchema }),
        prompt: userPrompt,
        providerOptions,
      }),
    systemPrompt,
    task: "mind-map-structure",
  });

  const structure = normalizeMindMapStructure(result.output);

  if (!structure) {
    throw new Error("The mind map's structure has too few branches or misses a part.");
  }

  return { data: structure, provenance, systemPrompt, userPrompt };
}
