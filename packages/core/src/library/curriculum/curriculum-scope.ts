import { type CallReuse } from "@zoonk/ai/provider-options";
import { type SearchTermsParams } from "@zoonk/ai/tasks/v2/identity/search-terms";
import { type CourseLevel } from "@zoonk/db";
import { type CandidateExam } from "../exams/candidate-exams";

/**
 * Who a goal's curriculum is written for. Shared content (`ownerId` null) is found and reused by
 * every later learner; a private course's rows belong to one learner and are never reused.
 * `generalGoal` is only the shareable part of the goal, so personal details never reach shared
 * content.
 */
export type CurriculumScope = {
  /**
   * The exam a shared curriculum's goal prepares for: its outlines are written at that exam's depth
   * and in its style for its candidates, without naming it. Absent for every other goal.
   */
  exams?: CandidateExam[];
  generalGoal: string | null;
  language: string;
  ownerId: string | null;
  targetLanguage: string | null;
};

/**
 * Private courses serve one learner, so their outlines, specs and lessons use the cheaper model
 * every curriculum eval ranked right behind the default (Gemini 3.8 Flash: outline 7.87, spec
 * 8.44, writer 7.74 at about a third to two thirds of the cost). The quality gate still reviews
 * their lessons from another family.
 */
const PRIVATE_CONTENT_MODEL = "google/gemini-3.8-flash";

/** The model override for content in a scope: the cheaper one for private courses, else the task's default. */
export function getScopeModel(scope: Pick<CurriculumScope, "ownerId">): string | undefined {
  return scope.ownerId ? PRIVATE_CONTENT_MODEL : undefined;
}

/**
 * Who reuses content once written, for its service tier (`chooseServiceTier`): a learner's private
 * content serves them; an exam's or a language's shared content is very likely read again, since
 * those goals share a limited set of courses; any other shared content may serve one learner.
 */
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

/** Who reuses content written in a scope (`getContentReuse`). */
export function getScopeReuse(
  scope: Pick<CurriculumScope, "exams" | "ownerId" | "targetLanguage">,
): CallReuse {
  return getContentReuse({
    forExam: Boolean(scope.exams?.length),
    ownerId: scope.ownerId,
    targetLanguage: scope.targetLanguage,
  });
}

/** Who an AI call ran for, so a goal's curriculum cost adds up per learner and goal. */
export type CurriculumAnalytics = SearchTermsParams["analytics"];

/** A skill from a goal's skill graph as outlines need it: its graph key and its Library row. */
export type GoalSkillRef = {
  description: string;
  id: string;
  key: string;
  /**
   * The lessons the goal's graph gives it, which a private course from the learner's material
   * follows: a test days away is planned on what fits before it.
   */
  lessons?: number;
  name: string;
};

/**
 * A skill a band already teaches in part, whose plan keeps a stand-in of `lessons` for the lessons
 * the Library hasn't written yet (see `getStandInLessons`): the band gains its next chapter.
 */
export type SkillExtension = { lessons: number; skill: GoalSkillRef };

/**
 * One level band of a course that a goal needs, with the goal's skills it must teach and, in
 * `extend`, skills it teaches in part and must teach further.
 */
export type CourseBandNeed = {
  extend?: SkillExtension[];
  level: CourseLevel;
  skills: GoalSkillRef[];
  /**
   * False when the goal's plan leaves out chapters that need a tool (an exam answered without
   * one): only chapters without tools count as teaching its skills, and new ones teach them
   * without tools. True when unset.
   */
  withToolChapters?: boolean;
};

function uniqueBy<T>(values: readonly T[], getKey: (value: T) => string): T[] {
  return values.filter(
    (value, index) => values.findIndex((other) => getKey(other) === getKey(value)) === index,
  );
}

/** One band from several of the same level: their skills and extensions together, once each. */
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

/**
 * A course's bands with one per level, in the order the learner reaches them. An outline run plans
 * each band from its level's next free position, all at once, so two bands of one level (a skill's
 * next chapter and another skill's first ones, asked for together) would place their chapters in
 * the same places.
 */
export function joinLevelBands(bands: readonly CourseBandNeed[]): CourseBandNeed[] {
  return [...Map.groupBy(bands, (band) => band.level).values()].flatMap(([first, ...rest]) =>
    first ? [joinBands([first, ...rest])] : [],
  );
}
