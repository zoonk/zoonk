import "server-only";
import { isJsonObject } from "@zoonk/utils/json";
import { cacheTag } from "next/cache";
import { getCertificatesCacheTag } from "../../cache/tags";
import {
  type UnitGoal,
  loadCertificateUnits,
} from "../../certificates/_utils/load-certificate-units";
import { type SavedPlan } from "../../learner/facts/saved-plan";
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

async function readPlanCertificates({
  goal,
  plan,
}: {
  goal: UnitGoal;
  plan: SavedPlan | null;
}): Promise<FieldMapView["certificates"]> {
  cacheTag(getCertificatesCacheTag(goal.userId));

  if (!plan) {
    return null;
  }

  const { due, held, units } = await loadCertificateUnits({ goal, plan });

  const earned = units.flatMap((unit) => {
    const row = held.find((entry) => entry.key === unit.key);

    return row
      ? { code: row.code, courseLevel: unit.courseLevel, locked: row.issuedAt === null }
      : [];
  });

  if (earned.length === 0 && due.length === 0) {
    return null;
  }

  return { earned, unclaimed: due.map((unit) => ({ courseLevel: unit.courseLevel })) };
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

  const [course, courses, certificates] = await Promise.all([
    loadPlanCourse({ goal, items: map.items }),
    loadMapCourses({ courseIds: map.courseIds, userId: goal.userId }),
    readPlanCertificates({ goal, plan: map.savedPlan }),
  ]);

  const areaCourses = courses.filter((entry) =>
    map.areas.some((area) => area.courseId === entry.courseId),
  );

  const skills = map.areas.flatMap((area) => area.skills);

  return {
    map: {
      areas: map.areas,
      certificates,
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
