import { CourseLevel, type GoalKind } from "@zoonk/db";
import { type JsonObject } from "@zoonk/utils/json";
import { getOwnLevel } from "../../learner/placement/placement-contract";
import { type OwnLevel } from "../../learner/placement/placement-steps";

const WHOLE_PATH_PURPOSES: ReadonlySet<unknown> = new Set(["careerChange", "work"]);

/** The band a learner studies first; `OWN_LEVEL_BEFORE` in the next-level flow is its inverse. */
const FIRST_BAND: Record<OwnLevel, CourseLevel> = {
  advanced: "advanced",
  basic: "beginner",
  intermediate: "intermediate",
  none: "beginner",
};

function readCourseLevel(value: unknown): CourseLevel | undefined {
  return Object.values(CourseLevel).find((level) => level === value);
}

/**
 * A broad learn goal is written one band at a time, and "Continue at {level}" starts the next with
 * its band set. A job's or a career change's first path stays whole, since it ends in the job.
 */
export function getGoalCourseLevel(goal: {
  details: JsonObject;
  kind: GoalKind;
}): CourseLevel | undefined {
  const { details } = goal;

  if (goal.kind !== "learn") {
    return undefined;
  }

  const chosen = readCourseLevel(details.courseLevel);

  if (chosen || WHOLE_PATH_PURPOSES.has(details.purpose)) {
    return chosen;
  }

  return details.purpose === "overview" ? "overview" : FIRST_BAND[getOwnLevel({ goal }) ?? "none"];
}
