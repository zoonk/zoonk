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
 * From the course-outline eval (6 cases, Astra judge, 26 Sep 2026): Opus 8.72,
 * Sol 8.70 and Gemini 3.8 Flash 7.87, at $207, $71 and $19 per 1,000 runs.
 * Sol ties Opus at a third of the cost; Flash left out pillars of broad bands. The two cheapest, on
 * 8 cases (7 Oct 2026): Luna 8.91 and Claude Haiku 5.5 8.69 against Sol's 9.05, at $2 and $5 per
 * 1,000 runs against $61; Luna's overviews left out foundations (GDP and unemployment in
 * economics, quantization and tunneling in quantum physics).
 */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["anthropic/claude-opus-5.5", "google/gemini-3.8-flash"] as const;

const schema = z.object({ chapters: z.array(chapterSchema) });

/** A skill from a goal's skill graph that this course level must teach. */
type RequiredSkill = {
  key: string;
  name: string;
  description: string;
  /** With `MATERIAL`: the lessons the learner's plan gives it, which the outline keeps to. */
  lessons?: number;
  /** For an exam's outline: the subject it sits in, which its chapter keeps to. */
  area?: string | null;
};

/**
 * A skill the band already teaches in `chapters`, whose next chapter the outline writes, of about
 * `lessons` lessons.
 */
type ExtendSkill = RequiredSkill & {
  chapters: { lessons: string[]; title: string }[];
  lessons: number;
};

export type CourseOutlineParams = {
  language: string;
  courseTitle: string;
  level: CourseLevel;
  requiredSkills?: RequiredSkill[];
  /** Skills the band teaches in part: only their next chapters are written. */
  extendSkills?: ExtendSkill[];
  /** Chapter titles already in the course's other level bands, so this band doesn't repeat them. */
  otherLevelChapters?: string[];
  /** Skills of this band that other chapters of this course already teach, so none is taught twice. */
  taughtElsewhere?: string[];
  /**
   * The learners who need the required and extended skills prepare for an exam answered without
   * tools of their own: those skills are taught as the exam asks them, in chapters without tools.
   */
  withoutTools?: boolean;
  /**
   * The exam the learners who need the required and extended skills prepare for: their chapters
   * are written at its depth and in its style for its candidates, without naming it.
   */
  exams?: LessonExam[];
  /**
   * A private course built from one learner's own class material: that material, page by page,
   * which the outline teaches exactly instead of the whole band.
   */
  material?: string;
  model?: string;
  /** The gateway tier it answers at (see `ServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** A skill's key, with its area in brackets when it has one: `algebra [Mathematics]`. */
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

/** The required and continued skills with an area (an exam's subject), which chapters keep to. */
function toSkillAreas(params: CourseOutlineParams): OutlineAreaSkill[] {
  return [...(params.requiredSkills ?? []), ...(params.extendSkills ?? [])].filter(
    (skill) => skill.area,
  );
}

/** What code found in an earlier draft, for the next one to avoid. */
function formatMixedAreaChapters(mixed: readonly MixedAreaChapter[]): string {
  return mixed
    .map((chapter) => `\n- "${chapter.title}" mixes ${chapter.areas.join(", ")}`)
    .join("");
}

/**
 * Which of the instructions' variant sections a call reads: the rules for an exam's skills only
 * when the outline is written for an exam, one area per chapter only when its skills have areas, a
 * learner's material only for their private course, and continuing skills only when it continues
 * some.
 */
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

/** The instructions; a second draft for mixing areas (`redraft`) also reads how to fix it. */
function buildSystemPrompt(params: CourseOutlineParams, redraft = false): string {
  return selectPromptVariants({ template, variants: { ...toPromptVariants(params), redraft } });
}

/**
 * The band's inputs. `WITHOUT_TOOLS` and `EXAMS` only for an outline written for an exam, and
 * `EXTEND_SKILLS` only when some instruction it reads mentions it, so no call reads a "no" or a
 * "none" for something it can't have.
 */
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

/**
 * The call's input. A second draft of an outline whose chapters mixed areas also gets
 * `MIXED_AREA_CHAPTERS`, the chapters to write again.
 */
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

/**
 * Writes the outline of one level band of a shared course: its chapters with
 * objectives and the tools they use, and every lesson's title, one-line
 * description, can-do line, estimated minutes and skills. Outlines come first
 * and cost little; lesson content is generated later, when a learner gets
 * close to it.
 */
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
    /** A draft written again for mixing areas, so its spend is counted too. */
    setAside: drafts
      .filter((draft) => draft !== kept)
      .map(({ provenance, usage }) => ({ model: provenance.model, usage })),
    systemPrompt: kept.systemPrompt,
    usage: kept.usage,
    userPrompt: kept.userPrompt,
  };
}

type OutlineDraft = Awaited<ReturnType<typeof draftOutline>>;

/** One call for the whole outline, cleaned, with the chapters that still mix areas. */
async function draftOutline({
  mixed,
  params,
}: {
  /** Chapters an earlier draft mixed areas in, to write again. */
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

/** What rows saved while the outline streams record about the run, before it ends. */
type StreamedChapterProvenance = {
  generatedAt: string;
  model: string;
  promptVersion: string;
  runId: string;
};

type StreamedChapter = {
  /** The finished chapters before it, in outline order. */
  before: OutlineChapter[];
  chapter: OutlineChapter;
  provenance: StreamedChapterProvenance;
};

/**
 * The same outline as `generateCourseOutline`, streamed for a band a learner is waiting on: the
 * first chapter `isEarlyChapter` accepts goes to `saveEarlyChapter` as soon as it's complete,
 * while the model still writes the rest, so its lessons can be saved and written early. `early`
 * is what that returned, or null when no chapter was accepted before the outline ended. The
 * chapter's provenance names the requested model; the finished provenance says whether a
 * fallback answered. Chapters that mix areas are split where their lessons allow but never
 * written again: the learner is waiting, and the early chapter is already saved.
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
