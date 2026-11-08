import { type CallReuse } from "@zoonk/ai/provider-options";
import { type SearchTermsParams } from "@zoonk/ai/tasks/identity/search-terms";
import { type CourseLevel } from "@zoonk/db";
import { type CandidateExam } from "../exams/candidate-exams";

export type CurriculumScope = {
  exams?: CandidateExam[];
  generalGoal: string | null;
  language: string;
  ownerId: string | null;
  targetLanguage: string | null;
};

/**
 * Private content can't spread its cost, so it takes the cheapest model that keeps quality. On the
 * 8 Nov 2026 evals Luna beat Gemini 3.8 Flash on course outlines (8.86 to 8.72), skill graphs (8.53
 * to 8.44) and challenges (8.34 to 7.36) at a sixth to a ninth of its cost; read side by side, its
 * graphs fell behind Terra's on career-change and from-zero goals.
 */
const PRIVATE_CONTENT_MODEL = "openai/gpt-6-luna";

type ScopeModels = { fallbackModels: readonly string[]; model: string };

/**
 * On 5 plans built from a learner's own job, notes or goal (8 Nov 2026), Terra scored 8.96 (EN
 * 8.63, PT 9.18) at $21.65/1k in 28 s p50, and Luna at high reasoning 7.86 (PT 7.69, under the
 * floor) at $9.27/1k in 144 s. Read blind, Terra won 4 and tied 1: Luna split one-lesson topics in
 * two and filled the new hook and application with placeholders. Opus is an outage route with no
 * run on these cases.
 */
const PRIVATE_LESSON_SPEC_MODELS: ScopeModels = {
  fallbackModels: ["anthropic/claude-opus-5.5"],
  model: "openai/gpt-6.1-terra",
};

export function getScopeModel(scope: Pick<CurriculumScope, "ownerId">): string | undefined {
  return scope.ownerId ? PRIVATE_CONTENT_MODEL : undefined;
}

export function getLessonSpecModels(
  scope: Pick<CurriculumScope, "ownerId">,
): ScopeModels | undefined {
  return scope.ownerId ? PRIVATE_LESSON_SPEC_MODELS : undefined;
}

export function getContentReuse({
  forExam,
  ownerId,
  targetLanguage,
}: {
  forExam: boolean;
  ownerId: string | null;
  targetLanguage: string | null;
}): CallReuse {
  if (ownerId) {
    return "personal";
  }

  return forExam || targetLanguage ? "bounded" : "library";
}

export type CurriculumAnalytics = SearchTermsParams["analytics"];

export type GoalSkillRef = {
  description: string;
  id: string;
  key: string;
  lessons?: number;
  name: string;
  area?: string | null;
};

/** Asks for the chapter after `afterChapterId`; once the course has a later one for the skill, the ask is answered. */
export type SkillExtension = { afterChapterId: string; lessons: number; skill: GoalSkillRef };

export type CourseBandNeed = {
  extend?: SkillExtension[];
  level: CourseLevel;
  skills: GoalSkillRef[];
  withToolChapters?: boolean;
};

/** `skillAreas`: an exam goal's subject for each skill of its plan graph, options included. */
export type CourseOutlineNeed = {
  bands: CourseBandNeed[];
  courseId: string;
  scope: CurriculumScope;
  skillAreas?: Record<string, string>;
};

export function toExamSkillAreas({
  scope,
  skills,
}: {
  scope: Pick<CurriculumScope, "exams">;
  skills: readonly { area?: string | null; skillId: string }[];
}): Pick<CourseOutlineNeed, "skillAreas"> {
  if (!scope.exams?.length) {
    return {};
  }

  return {
    skillAreas: Object.fromEntries(
      skills.flatMap((skill) => (skill.area ? [[skill.skillId, skill.area] as const] : [])),
    ),
  };
}

function uniqueBy<T>(values: readonly T[], getKey: (value: T) => string): T[] {
  return values.filter(
    (value, index) => values.findIndex((other) => getKey(other) === getKey(value)) === index,
  );
}

function joinBands([first, ...rest]: readonly [CourseBandNeed, ...CourseBandNeed[]]) {
  if (rest.length === 0) {
    return first;
  }

  const bands = [first, ...rest];

  const extend = uniqueBy(
    bands.flatMap((band) => band.extend ?? []),
    (extension) => extension.skill.id,
  );

  return {
    ...(extend.length > 0 && { extend }),
    level: first.level,
    skills: uniqueBy(
      bands.flatMap((band) => band.skills),
      (skill) => skill.id,
    ),
    withToolChapters: bands.some((band) => band.withToolChapters === false)
      ? false
      : first.withToolChapters,
  };
}

export function joinLevelBands(bands: readonly CourseBandNeed[]): CourseBandNeed[] {
  return [...Map.groupBy(bands, (band) => band.level).values()].flatMap(([first, ...rest]) =>
    first ? [joinBands([first, ...rest])] : [],
  );
}
