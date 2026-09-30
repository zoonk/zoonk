import { type SearchTermsParams } from "@zoonk/ai/tasks/v2/identity/search-terms";
import { type CourseLevel } from "@zoonk/db";

/**
 * Who a goal's curriculum is written for. Shared content (`ownerId` null) is found and reused by
 * every later learner; a private course's rows belong to one learner and are never reused.
 * `generalGoal` is only the shareable part of the goal, so personal details never reach shared
 * content.
 */
export type CurriculumScope = {
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

/** Who an AI call ran for, so a goal's curriculum cost adds up per learner and goal. */
export type CurriculumAnalytics = SearchTermsParams["analytics"];

/** A skill from a goal's skill graph as outlines need it: its graph key and its Library row. */
export type GoalSkillRef = { description: string; id: string; key: string; name: string };

/**
 * A skill a band already teaches in part, which the goal's graph gives `lessons` in all: the band
 * gains its next chapter while fewer lessons teach it.
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
};
