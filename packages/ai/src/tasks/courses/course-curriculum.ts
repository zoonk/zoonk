import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./course-curriculum.prompt.md";
import { type CourseDiscoveryBrief } from "./course-discovery";

const MAX_OVERVIEW_CHAPTERS = 6;

const curriculumLevelSchema = z.enum([
  "overview",
  "basic",
  "intermediate",
  "advanced",
  "a1",
  "a2",
  "b1",
  "b2",
  "c1",
  "c2",
]);
export type CurriculumLevel = z.infer<typeof curriculumLevelSchema>;

const chapterSchema = z.object({
  description: z.string().min(1),
  key: z.string().min(1),
  outcomes: z.array(z.string().min(1)).min(1),
  prerequisiteKeys: z.array(z.string().min(1)),
  title: z.string().min(1),
});

const schema = z.object({ chapters: z.array(chapterSchema).min(1) });
export type CurriculumChapter = z.infer<typeof chapterSchema> & { level: CurriculumLevel | null };
export type CourseCurriculumParams = {
  courseTitle: string;
  language: string;
  format: "core" | "language" | "question" | "personalized";
  level: CurriculumLevel | null;
  targetLanguage: string | null;
  brief?: CourseDiscoveryBrief | null;
  otherChapters?: CurriculumChapter[];
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};

/** A requested level is trusted context, never inferred from generated positions. */
export async function generateCourseCurriculumLevel({
  courseTitle,
  language,
  format,
  level,
  targetLanguage,
  brief,
  otherChapters = [],
  model = format === "personalized" ? "openai/gpt-5.6-luna" : "openai/gpt-5.6-sol",
  useFallback = format !== "personalized",
  reasoning,
}: CourseCurriculumParams) {
  if (format === "personalized" && !brief) {
    throw new Error("A private curriculum requires its resolved discovery brief");
  }

  if (format !== "personalized" && brief) {
    throw new Error("Private learner context cannot shape a reusable curriculum");
  }

  const userPrompt = JSON.stringify({
    COURSE_TITLE: courseTitle,
    FORMAT: format,
    LANGUAGE: getPromptLanguageName({ language }),
    LEVEL: level,
    OTHER_CHAPTERS: otherChapters,
    PRIVATE_BRIEF: format === "personalized" ? brief : null,
    TARGET_LANGUAGE: targetLanguage,
  });

  const { output, usage } = await generateText({
    instructions: systemPrompt,
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions: buildProviderOptions({
      fallbackModels: format === "personalized" ? [] : ["openai/gpt-6-astra"],
      model,
      useFallback,
    }),
    reasoning,
  });

  if (
    level === "overview" &&
    (output.chapters.length < 3 || output.chapters.length > MAX_OVERVIEW_CHAPTERS)
  ) {
    throw new Error("An overview must contain three to six chapters");
  }

  if (format === "question" && output.chapters.length !== 1) {
    throw new Error("A question course must contain exactly one chapter");
  }

  const keys = output.chapters.map((chapter) => chapter.key);
  const otherKeys = new Set(otherChapters.map((chapter) => chapter.key));

  if (new Set(keys).size !== keys.length || keys.some((key) => otherKeys.has(key))) {
    throw new Error("Curriculum chapter keys must be unique");
  }

  if (
    output.chapters.some((chapter, index) =>
      chapter.prerequisiteKeys.some(
        (key) => !otherKeys.has(key) && !keys.slice(0, index).includes(key),
      ),
    )
  ) {
    throw new Error("Curriculum prerequisites must refer to earlier chapters");
  }

  return {
    data: { chapters: output.chapters.map((chapter) => ({ ...chapter, level })) },
    systemPrompt,
    usage,
    userPrompt,
  };
}
