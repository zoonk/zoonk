import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { draftAgainWhenFlawed } from "../_utils/draft-again";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { selectPromptVariants } from "../_utils/prompt-variants";
import { type CourseLevel } from "./_utils/course-levels";
import template from "./teaching-chapters.prompt.md";

/** Terra placed every skill in its chapter, as Sonnet did, at a fifth of the cost (30 Oct 2026). */
const defaultModel = "openai/gpt-6.1-terra";
const fallbackModels = ["anthropic/claude-sonnet-5.5", "google/gemini-3.8-flash"] as const;

const answerSchema = z.object({ after: z.number(), chapter: z.number().nullable() });

type Answer = z.infer<typeof answerSchema>;

type BandChapter = { title: string; lessons: string[] };

type BandSkill = {
  key: string;
  name: string;
  description: string;
  /** The band's chapters that teach it so far, by number, when its learners need more of it. */
  taughtIn?: number[];
};

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

/**
 * `chapter` teaches the skill already, or more of it than the chapters it's taught in; otherwise a
 * chapter for it goes after `after` (0: first).
 */
type TeachingChapter = { after: number; chapter: number | null; key: string };

/** Every skill gets an answer: one left out would read as untaught and get a second chapter. */
function toSchema(skills: readonly BandSkill[]) {
  return z.object({
    skills: z.object(Object.fromEntries(skills.map((skill) => [skill.key, answerSchema]))),
  });
}

function formatChapter({ chapter, index }: { chapter: BandChapter; index: number }): string {
  return `${index + 1}. ${chapter.title}: ${chapter.lessons.join("; ")}`;
}

function formatSkill(skill: BandSkill): string {
  const taught = skill.taughtIn?.length ? ` (taught in ${skill.taughtIn.join(", ")})` : "";
  return `- ${skill.key}: ${skill.name}. ${skill.description}${taught}`;
}

function buildSystemPrompt(params: TeachingChaptersParams): string {
  return selectPromptVariants({
    template,
    variants: { continued: params.skills.some((skill) => skill.taughtIn?.length) },
  });
}

function buildUserPrompt(params: TeachingChaptersParams): string {
  return `
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
    COURSE_TITLE: ${params.courseTitle}
    LEVEL: ${params.level}
    BAND_CHAPTERS:
${params.chapters.map((chapter, index) => formatChapter({ chapter, index })).join("\n")}
    SKILLS:
${params.skills.map((skill) => formatSkill(skill)).join("\n")}
  `;
}

function isValid({
  answer,
  count,
  skill,
}: {
  answer?: Answer;
  count: number;
  skill: BandSkill;
}): boolean {
  if (!answer) {
    return false;
  }

  const { after, chapter } = answer;

  return chapter === null
    ? Number.isInteger(after) && after >= 0 && after <= count
    : Number.isInteger(chapter) &&
        chapter >= 1 &&
        chapter <= count &&
        !skill.taughtIn?.includes(chapter);
}

function countInvalid({
  answers,
  count,
  skills,
}: {
  answers: Readonly<Record<string, Answer>>;
  count: number;
  skills: readonly BandSkill[];
}): number {
  return skills.filter((skill) => !isValid({ answer: answers[skill.key], count, skill })).length;
}

function toTeachingChapter({ answer, key }: { answer: Answer; key: string }): TeachingChapter {
  return { after: answer.chapter ?? answer.after, chapter: answer.chapter, key };
}

async function draftAnswers({
  params,
  systemPrompt,
  userPrompt,
}: {
  params: TeachingChaptersParams;
  systemPrompt: string;
  userPrompt: string;
}) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: toSchema(params.skills) }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "teaching-chapters",
  });

  return { answers: result.output.skills, provenance, usage: result.usage };
}

export async function findTeachingChapters(params: TeachingChaptersParams) {
  const systemPrompt = buildSystemPrompt(params);
  const userPrompt = buildUserPrompt(params);
  const count = params.chapters.length;

  const kept = await draftAgainWhenFlawed({
    countProblems: (draft) =>
      countInvalid({ answers: draft.answers, count, skills: params.skills }),
    draft: () => draftAnswers({ params, systemPrompt, userPrompt }),
  });

  // Only an answer that names no chapter may write one: a wrong number would repeat a topic.
  if (countInvalid({ answers: kept.answers, count, skills: params.skills }) > 0) {
    throw new Error(
      "The teaching chapters named a chapter the band doesn't have, or one the skill has.",
    );
  }

  return {
    data: params.skills.flatMap(({ key }) => {
      const answer = kept.answers[key];
      return answer ? [toTeachingChapter({ answer, key })] : [];
    }),
    provenance: kept.provenance,
    systemPrompt,
    usage: kept.usage,
    userPrompt,
  };
}
