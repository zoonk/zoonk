import "server-only";
import { isJsonObject } from "@zoonk/utils/json";
import { countSkillStates } from "../../learner/mastery-state";
import { loadPlanCourse } from "../../plans/_utils/plan-course";
import { loadGoalMap } from "../_utils/goal-map";
import { listFadingSkills } from "../_utils/group-skills";
import { resolveViewGoal } from "../_utils/resolve-view-goal";
import { buildStudyNext, loadMapCourses } from "./_utils/map-courses";
import { type FieldMapView } from "./map-contract";

export type FieldMapViewResult =
  | { map: FieldMapView; status: "ready" }
  | { status: "noGoal" | "notFound" | "unauthorized" };

function isRefreshGoal(details: unknown): boolean {
  return isJsonObject(details) && details.purpose === "refresh";
}

/** Requires an owned goal (active by default); completed plans may offer next study, refresh goals lead with fading skills. */
export async function getFieldMapView(
  input: { goalId?: string } = {},
): Promise<FieldMapViewResult> {
  "use cache: private";

  const resolved = await resolveViewGoal(input.goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  const { goal } = resolved;
  const map = await loadGoalMap({ goal });

  const [course, courses] = await Promise.all([
    loadPlanCourse({ goal, items: map.items }),
    loadMapCourses({ courseIds: map.courseIds, userId: goal.userId }),
  ]);

  const areaCourses = courses.filter((entry) =>
    map.areas.some((area) => area.courseId === entry.courseId),
  );

  const skills = map.areas.flatMap((area) => area.skills);

  return {
    map: {
      areas: map.areas,
      counts: countSkillStates(skills),
      course,
      courses: areaCourses.map(({ courseId, title }) => ({ courseId, title })),
      goal: { id: goal.id, kind: goal.kind, title: goal.title },
      next: map.finished ? buildStudyNext({ course, courses, goalKind: goal.kind }) : null,
      phases: map.phases,
      refresh: { emphasized: isRefreshGoal(goal.details), skills: listFadingSkills(skills) },
    },
    status: "ready",
  };
}
