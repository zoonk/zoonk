import "server-only";
import { Output, generateText, streamText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration, startTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { draftAgainWhenFlawed } from "../../_utils/draft-again";
import { formatLocalContext } from "../../_utils/language-context";
import { type LessonExam, formatLessonExams } from "../../_utils/lesson-exams";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { selectPromptVariants } from "../../_utils/prompt-variants";
import { type CourseLevel } from "./_utils/course-levels";
import { chapterSchema } from "./_utils/course-outline-schema";
import { type CourseOutline, normalizeCourseOutline } from "./_utils/normalize-course-outline";
import {
  type MixedAreaChapter,
  type OutlineAreaSkill,
  findMixedAreaChapters,
} from "./_utils/outline-areas";
import { readStreamedChapter } from "./_utils/streamed-chapter";
import template from "./course-outline.prompt.md";

/**
 * Sol tied Opus on the course-outline eval at a third of the cost (26 Sep 2026); Luna's cheaper
 * overviews left out foundations (7 Oct 2026).
 */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["anthropic/claude-opus-5.5", "google/gemini-3.8-flash"] as const;

const schema = z.object({ chapters: z.array(chapterSchema) });

type RequiredSkill = {
  key: string;
  name: string;
  description: string;
  /** With `MATERIAL`, the outline keeps to the plan's lessons for it. */
  lessons?: number;
  /** An exam's subject, which its chapter keeps to. */
  area?: string | null;
};

type ExtendSkill = RequiredSkill & {
  chapters: { lessons: string[]; title: string }[];
  lessons: number;
};

export type CourseOutlineParams = {
  language: string;
  courseTitle: string;
  level: CourseLevel;
  requiredSkills?: RequiredSkill[];
  extendSkills?: ExtendSkill[];
  otherLevelChapters?: string[];
  taughtElsewhere?: string[];
  /** For an exam answered without tools: the skills are taught as it asks them, without tools. */
  withoutTools?: boolean;
  exams?: LessonExam[];
  /** A private course's class material, which the outline teaches exactly instead of the band. */
  material?: string;
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatSkillKey(skill: RequiredSkill): string {
  return skill.area ? `${skill.key} [${skill.area}]` : skill.key;
}

function formatRequiredSkills(skills: readonly RequiredSkill[]): string {
  return skills.length === 0
    ? "none"
    : skills
        .map((skill) => {
          const lessons = skill.lessons ? ` (about ${skill.lessons} lessons)` : "";
          return `\n- ${formatSkillKey(skill)}: ${skill.name}. ${skill.description}${lessons}`;
        })
        .join("");
}

function formatExtendSkill(skill: ExtendSkill): string {
  const chapters = skill.chapters
    .map((chapter) => `\n  - ${chapter.title}: ${chapter.lessons.join("; ")}`)
    .join("");

  return `\n- ${formatSkillKey(skill)}: ${skill.name}. ${skill.description}\n  Chapters so far:${chapters}\n  Lessons in the next chapter: ${skill.lessons}`;
}

function formatExtendSkills(skills: readonly ExtendSkill[]): string {
  return skills.length === 0 ? "none" : skills.map((skill) => formatExtendSkill(skill)).join("");
}

function formatTitles(titles: readonly string[]): string {
  return titles.length === 0 ? "none" : titles.map((title) => `\n- ${title}`).join("");
}

function toSkillAreas(params: CourseOutlineParams): OutlineAreaSkill[] {
  return [...(params.requiredSkills ?? []), ...(params.extendSkills ?? [])].filter(
    (skill) => skill.area,
  );
}

function formatMixedAreaChapters(mixed: readonly MixedAreaChapter[]): string {
  return mixed
    .map((chapter) => `\n- "${chapter.title}" mixes ${chapter.areas.join(", ")}`)
    .join("");
}

function toPromptVariants(params: CourseOutlineParams) {
  const exams = Boolean(params.exams?.length);
  const withoutTools = Boolean(params.withoutTools);

  return {
    areas: toSkillAreas(params).length > 0,
    examSkills: exams || withoutTools,
    exams,
    extend: Boolean(params.extendSkills?.length),
    material: Boolean(params.material),
    withoutTools,
  };
}

function buildSystemPrompt(params: CourseOutlineParams, redraft = false): string {
  return selectPromptVariants({ template, variants: { ...toPromptVariants(params), redraft } });
}

function formatBandInputs(params: CourseOutlineParams): string {
  const variants = toPromptVariants(params);

  return [
    `LANGUAGE: ${getPromptLanguageName({ language: params.language })}`,
    `COURSE_TITLE: ${params.courseTitle}`,
    `LEVEL: ${params.level}`,
    `REQUIRED_SKILLS: ${formatRequiredSkills(params.requiredSkills ?? [])}`,
    (variants.extend || variants.examSkills) &&
      `EXTEND_SKILLS: ${formatExtendSkills(params.extendSkills ?? [])}`,
    `OTHER_LEVEL_CHAPTERS: ${formatTitles(params.otherLevelChapters ?? [])}`,
    `TAUGHT_ELSEWHERE: ${formatTitles(params.taughtElsewhere ?? [])}`,
    variants.withoutTools && "WITHOUT_TOOLS: yes",
    variants.exams && formatLessonExams(params.exams),
  ]
    .filter(Boolean)
    .map((line) => `    ${line}`)
    .join("\n");
}

function buildUserPrompt(
  params: CourseOutlineParams,
  mixed: readonly MixedAreaChapter[] = [],
): string {
  return `
${formatBandInputs(params)}${mixed.length > 0 ? `\n    MIXED_AREA_CHAPTERS: ${formatMixedAreaChapters(mixed)}` : ""}

${formatLocalContext(params.language)}
${params.material ? `\n${formatUntrustedInput({ MATERIAL: params.material })}` : ""}
  `;
}

export async function generateCourseOutline(params: CourseOutlineParams) {
  const drafts: OutlineDraft[] = [];

  // A chapter that still mixes areas after code splits what it can is written again once, told
  // which; when the second draft mixes as many, the first stays.
  const kept = await draftAgainWhenFlawed<OutlineDraft>({
    countProblems: (draft) => draft.mixed.length,
    draft: async (previous) => {
      const draft = await draftOutline({ mixed: previous?.mixed ?? [], params });
      drafts.push(draft);
      return draft;
    },
  });

  return {
    data: kept.data,
    provenance: kept.provenance,
    /** So a draft written again for mixing areas counts in the spend too. */
    setAside: drafts
      .filter((draft) => draft !== kept)
      .map(({ provenance, usage }) => ({ model: provenance.model, usage })),
    systemPrompt: kept.systemPrompt,
    usage: kept.usage,
    userPrompt: kept.userPrompt,
  };
}

type OutlineDraft = Awaited<ReturnType<typeof draftOutline>>;

async function draftOutline({
  mixed,
  params,
}: {
  mixed: readonly MixedAreaChapter[];
  params: CourseOutlineParams;
}) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const systemPrompt = buildSystemPrompt(params, mixed.length > 0);
  const userPrompt = buildUserPrompt(params, mixed);
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });
  const skillAreas = toSkillAreas(params);

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
    task: "course-outline",
  });

  const data: CourseOutline = normalizeCourseOutline({
    level: params.level,
    raw: result.output,
    requiredSkillKeys: toRequiredSkillKeys(params),
    skillAreas,
  });

  return {
    data,
    mixed: findMixedAreaChapters({ chapters: data.chapters, skills: skillAreas }),
    provenance,
    systemPrompt,
    usage: result.usage,
    userPrompt,
  };
}

function toRequiredSkillKeys(params: CourseOutlineParams): string[] {
  return [...(params.requiredSkills ?? []), ...(params.extendSkills ?? [])].map(
    (skill) => skill.key,
  );
}

type OutlineChapter = CourseOutline["chapters"][number];

type StreamedChapterProvenance = {
  generatedAt: string;
  model: string;
  promptVersion: string;
  runId: string;
};

type StreamedChapter = {
  before: OutlineChapter[];
  chapter: OutlineChapter;
  provenance: StreamedChapterProvenance;
};

/**
 * The early chapter's provenance names the requested model; the finished one says whether a
 * fallback answered. Chapters that mix areas are never written again: the learner is waiting.
 */
export async function streamCourseOutline<T>({
  isEarlyChapter,
  saveEarlyChapter,
  ...params
}: CourseOutlineParams & {
  isEarlyChapter: (chapter: OutlineChapter) => boolean;
  saveEarlyChapter: (found: StreamedChapter) => Promise<T>;
}) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const systemPrompt = buildSystemPrompt(params);
  const userPrompt = buildUserPrompt(params);
  const requiredSkillKeys = toRequiredSkillKeys(params);
  const skillAreas = toSkillAreas(params);
  const run = startTaskGeneration({ analytics, systemPrompt, task: "course-outline" });
  const earlyChapter = Promise.withResolvers<Omit<StreamedChapter, "provenance"> | null>();

  const generation = streamText({
    instructions: systemPrompt,
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions: buildProviderOptions({ fallbackModels, model, serviceTier, useFallback }),
    reasoning,
  });

  const provenance = {
    generatedAt: new Date().toISOString(),
    model,
    promptVersion: run.promptVersion,
    runId: run.runId,
  };

  const finishOutline = async () => {
    for await (const partial of generation.partialOutputStream) {
      const found = readStreamedChapter({
        chapters: partial.chapters,
        isWanted: isEarlyChapter,
        level: params.level,
        requiredSkillKeys,
        skillAreas,
      });

      if (found) {
        earlyChapter.resolve(found);
      }
    }

    earlyChapter.resolve(null);

    const [output, finalStep, steps, usage] = await Promise.all([
      generation.output,
      generation.finalStep,
      generation.steps,
      generation.usage,
    ]);

    return {
      data: normalizeCourseOutline({
        level: params.level,
        raw: output,
        requiredSkillKeys,
        skillAreas,
      }),
      provenance: await run.finish({ finalStep, steps, usage }),
      usage,
    };
  };

  const saveEarly = async (): Promise<T | null> => {
    const found = await earlyChapter.promise;
    return found ? saveEarlyChapter({ ...found, provenance }) : null;
  };

  const [outline, early] = await Promise.allSettled([
    finishOutline().finally(() => earlyChapter.resolve(null)),
    saveEarly(),
  ]);

  if (outline.status === "rejected") {
    throw outline.reason;
  }

  if (early.status === "rejected") {
    throw early.reason;
  }

  return { ...outline.value, early: early.value, systemPrompt, userPrompt };
}
