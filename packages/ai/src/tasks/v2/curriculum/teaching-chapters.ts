import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { type CourseLevel } from "./_utils/course-levels";
import template from "./teaching-chapters.prompt.md";

/** Sonnet 5.5 found the chapter of every skill the PR preview wrote again, at 7.8s (30 Oct 2026). */
const defaultModel = "anthropic/claude-sonnet-5.5";
const fallbackModels = ["google/gemini-3.8-flash", "openai/gpt-6.1-sol"] as const;

const schema = z.object({
  skills: z.array(z.object({ after: z.number(), chapter: z.number().nullable(), key: z.string() })),
});

type BandChapter = { title: string; lessons: string[] };

type BandSkill = { key: string; name: string; description: string };

export type TeachingChaptersParams = {
  language: string;
  courseTitle: string;
  level: CourseLevel;
  /** The band's chapters in order; answers number them from 1. */
  chapters: BandChapter[];
  skills: BandSkill[];
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** `chapter` teaches the skill already; otherwise a chapter for it goes after `after` (0: first). */
type TeachingChapter = { after: number; chapter: number | null; key: string };

function formatChapter({ chapter, index }: { chapter: BandChapter; index: number }): string {
  return `${index + 1}. ${chapter.title}: ${chapter.lessons.join("; ")}`;
}

function buildUserPrompt(params: TeachingChaptersParams): string {
  return `
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
    COURSE_TITLE: ${params.courseTitle}
    LEVEL: ${params.level}
    BAND_CHAPTERS:
${params.chapters.map((chapter, index) => formatChapter({ chapter, index })).join("\n")}
    SKILLS:
${params.skills.map((skill) => `- ${skill.key}: ${skill.name}. ${skill.description}`).join("\n")}
  `;
}

function toChapterNumber({ count, value }: { count: number; value: number | null }) {
  return value !== null && Number.isInteger(value) && value >= 1 && value <= count ? value : null;
}

function toAfter({ count, value }: { count: number; value: number }): number {
  return Number.isInteger(value) ? Math.min(Math.max(value, 0), count) : count;
}

/** One answer per requested skill, in their order: a skill left out is written after the band. */
function normalizeTeachingChapters({
  answers,
  count,
  skills,
}: {
  answers: readonly TeachingChapter[];
  count: number;
  skills: readonly Pick<BandSkill, "key">[];
}): TeachingChapter[] {
  return skills.map(({ key }) => {
    const answer = answers.find((entry) => entry.key === key);
    const chapter = answer ? toChapterNumber({ count, value: answer.chapter }) : null;
    const after = chapter ?? (answer ? toAfter({ count, value: answer.after }) : count);

    return { after, chapter, key };
  });
}

export async function findTeachingChapters(params: TeachingChaptersParams) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const systemPrompt = template;
  const userPrompt = buildUserPrompt(params);
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
    libraryInput: true,
    systemPrompt,
    task: "teaching-chapters",
  });

  const data = normalizeTeachingChapters({
    answers: result.output.skills,
    count: params.chapters.length,
    skills: params.skills,
  });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
