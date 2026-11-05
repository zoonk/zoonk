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

const defaultModel = "anthropic/claude-haiku-5.5";
const fallbackModels = ["openai/gpt-6-luna", "google/gemini-3.8-flash"] as const;

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

/** One call per lesson. Code keeps only quotes the screens really have (`normalizeLessonMarks`). */
export async function tagLesson({
  analytics,
  ideas,
  language,
  lessonTitle,
  model = defaultModel,
  reasoning,
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
        ...(reasoning ? { reasoning } : {}),
      }),
    libraryInput: true,
    systemPrompt: promptTemplate,
    task: "lesson-marks",
  });

  const data: LessonMarks = normalizeLessonMarks({ ideas, output: result.output, screens });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
