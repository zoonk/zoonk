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

const PRIVATE_CONTENT_MODEL = "google/gemini-3.8-flash";

/**
 * On 8 private lessons (4 Nov 2026), Luna's plans tied Terra's and Sol's (8.15, 8.18, 8.10) at a
 * tenth of Sol's price, ahead of Gemini 3.8 Flash (7.61).
 */
const PRIVATE_LESSON_SPEC_MODEL = "openai/gpt-6-luna";

export function getScopeModel(scope: Pick<CurriculumScope, "ownerId">): string | undefined {
  return scope.ownerId ? PRIVATE_CONTENT_MODEL : undefined;
}

export function getLessonSpecModel(scope: Pick<CurriculumScope, "ownerId">): string | undefined {
  return scope.ownerId ? PRIVATE_LESSON_SPEC_MODEL : undefined;
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

/** `skillAreas`: an exam goal's subject for each of its skills in the course. */
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
