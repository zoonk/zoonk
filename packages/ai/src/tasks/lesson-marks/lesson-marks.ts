import "server-only";
import { Output, generateText } from "ai";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import {
  type CallWait,
  type Reasoning,
  buildProviderOptions,
  chooseServiceTier,
} from "../../provider-options";
import { fillPromptLanguages } from "../_utils/prompt-language";
import {
  type LessonMarks,
  type MarksIdea,
  type MarksScreen,
  canScreenGetIcon,
  lessonMarksOutputSchema,
  normalizeLessonMarks,
} from "./lesson-marks-schema";
import promptTemplate from "./lesson-marks.prompt.md";

/**
 * On the lesson-marks eval (13 lessons, 5 Nov 2026), Luna at minimal reasoning scored 9.17 at
 * $0.71 per 1,000 lessons and 11s p50, and wrote the about lines that least gave the answer away
 * (9.54). Haiku 5.5 without reasoning took 5.7s but scored 8.08; with its default reasoning, 8.66 in
 * 18.7s; Gemini 3.5 Flash-Lite 8.83 in 19.2s at $16.52.
 */
const defaultModel = "openai/gpt-6-luna";
const defaultReasoning: Reasoning = "minimal";
const fallbackModels = ["anthropic/claude-haiku-5.5", "google/gemini-3.5-flash-lite"] as const;

export type LessonMarksParams = {
  ideas: MarksIdea[];
  language: string;
  lessonTitle: string;
  screens: MarksScreen[];
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
  wait?: CallWait;
};

function describeScreen(screen: MarksScreen): string {
  switch (screen.kind) {
    case "explanation":
      return canScreenGetIcon(screen)
        ? "explanation, may get an icon"
        : "explanation with its own picture";
    case "guess":
      return "guess";
    case "question":
      return "question";
    case "workedExample":
      return "worked example";
    default:
      return screen.kind;
  }
}

function formatIdeas(ideas: readonly MarksIdea[]): string {
  if (ideas.length === 0) {
    return "(none)";
  }

  return ideas
    .map((idea, index) => `${index + 1}. ${idea.label ? `${idea.label}: ` : ""}${idea.text}`)
    .join("\n");
}

function formatScreens(screens: readonly MarksScreen[]): string {
  return screens
    .map((screen, index) =>
      [`SCREEN ${index + 1} (${describeScreen(screen)})`, screen.title, screen.text]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

function buildUserPrompt({
  ideas,
  lessonTitle,
  screens,
}: Pick<LessonMarksParams, "ideas" | "lessonTitle" | "screens">) {
  return [
    `LESSON: ${lessonTitle}`,
    `IDEAS:\n${formatIdeas(ideas)}`,
    `SCREENS:\n\n${formatScreens(screens)}`,
  ].join("\n\n");
}

export async function tagLesson({
  analytics,
  ideas,
  language,
  lessonTitle,
  model = defaultModel,
  reasoning = defaultReasoning,
  screens,
  useFallback = true,
  wait = "soon",
}: LessonMarksParams) {
  const systemPrompt = fillPromptLanguages({
    learnerLanguage: language,
    targetLanguage: language,
    template: promptTemplate,
  });

  const userPrompt = buildUserPrompt({ ideas, lessonTitle, screens });

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
        output: Output.object({ schema: lessonMarksOutputSchema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt: promptTemplate,
    task: "lesson-marks",
  });

  const data: LessonMarks = normalizeLessonMarks({ ideas, output: result.output, screens });

  return { data, output: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
