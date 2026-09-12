import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./course-path.prompt.md";

const defaultModel = "openai/gpt-5.6-luna";

const schema = z.object({
  chapterIds: z.array(z.string().min(1)).min(1),
  summary: z.string().min(1),
});

type CoursePathChapter = {
  id: string;
  title: string;
  description: string;
  level: string | null;
  outcomes?: string[];
  prerequisiteIds: string[];
};
export type CoursePathParams = {
  courseTitle: string;
  language: string;
  goal: string;
  startingKnowledge: string;
  selectedLevel: string | null;
  depth: "overview" | "complete" | "focused";
  chapters: CoursePathChapter[];
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};

/** The model selects existing chapters; it cannot invent persisted resources. */
export async function generateCoursePath({
  courseTitle,
  language,
  goal,
  startingKnowledge,
  selectedLevel,
  depth,
  chapters,
  model = defaultModel,
  useFallback = false,
  reasoning,
}: CoursePathParams) {
  if (chapters.length === 0) {
    throw new Error("Cannot select a learning path from an empty curriculum");
  }

  const userPrompt = JSON.stringify({
    CHAPTERS: chapters,
    COURSE_TITLE: courseTitle,
    DEPTH: depth,
    GOAL: goal,
    LANGUAGE: getPromptLanguageName({ language }),
    SELECTED_LEVEL: selectedLevel,
    STARTING_KNOWLEDGE: startingKnowledge,
  });

  const { output, usage } = await generateText({
    instructions: systemPrompt,
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions: buildProviderOptions({ fallbackModels: [], model, useFallback }),
    reasoning,
  });

  const availableIds = new Set(chapters.map((chapter) => chapter.id));

  if (output.chapterIds.some((id) => !availableIds.has(id))) {
    throw new Error("The learning path references a chapter outside the supplied curriculum");
  }

  if (new Set(output.chapterIds).size !== output.chapterIds.length) {
    throw new Error("The learning path repeats a chapter");
  }

  return { data: output, systemPrompt, usage, userPrompt };
}
