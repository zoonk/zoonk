import { getPlanWorkload } from "../../plans/_utils/plan-numbers";
import { type BuiltPlan } from "../../plans/planner/build-plan";
import { type CoursePlanEstimate } from "../course-estimate-contract";
import { type CourseEstimateData } from "./course-estimate-data";

export function getCourseEstimateWorkload({
  built,
  data,
}: {
  built: BuiltPlan;
  data: CourseEstimateData;
}): CoursePlanEstimate["workload"] {
  return getPlanWorkload({
    built,
    lessonMinutes: new Map(
      [...data.lessons, ...data.quickLessons.values()].map((lesson) => [
        lesson.lessonId,
        lesson.minutes,
      ]),
    ),
    paceFactor: data.pace.factor,
  });
}
