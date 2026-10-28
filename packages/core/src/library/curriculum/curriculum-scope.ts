import { type CallReuse } from "@zoonk/ai/provider-options";
import { type SearchTermsParams } from "@zoonk/ai/tasks/v2/identity/search-terms";
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

export function getScopeReuse(
  scope: Pick<CurriculumScope, "exams" | "ownerId" | "targetLanguage">,
): CallReuse {
  return getContentReuse({
    forExam: Boolean(scope.exams?.length),
    ownerId: scope.ownerId,
    targetLanguage: scope.targetLanguage,
  });
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

export type SkillExtension = { lessons: number; skill: GoalSkillRef };

export type CourseBandNeed = {
  extend?: SkillExtension[];
  level: CourseLevel;
  skills: GoalSkillRef[];
  withToolChapters?: boolean;
};

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
