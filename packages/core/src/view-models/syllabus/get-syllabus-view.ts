import "server-only";
import { cacheTag } from "next/cache";
import { getExamBlueprintCacheTag } from "../../cache/tags";
import { resolveViewGoal } from "../_utils/resolve-view-goal";
import { buildSyllabus } from "./_utils/build-syllabus";
import { loadSyllabusInput } from "./_utils/load-syllabus";
import { type SyllabusView } from "./syllabus-contract";

export type SyllabusViewResult =
  | { status: "noGoal" | "notFound" | "unauthorized" }
  | { status: "ready"; syllabus: SyllabusView };

/**
 * The structure of a goal (the active goal by default), so the learner can see all of it and trust
 * it's complete: an exam's notice subjects and topics in its own words, each with progress and when
 * the plan studies it next, or the plan's modules with their chapters. A goal without a plan yet
 * isn't found. The API serves the same view as `GET /v1/goals/{goalId}/syllabus`.
 */
export async function getSyllabusView(
  input: { goalId?: string } = {},
): Promise<SyllabusViewResult> {
  "use cache: private";

  const resolved = await resolveViewGoal(input.goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  const { goal } = resolved;

  if (goal.examBlueprintId) {
    cacheTag(getExamBlueprintCacheTag(goal.examBlueprintId));
  }

  const syllabusInput = await loadSyllabusInput(goal);

  if (!syllabusInput) {
    return { status: "notFound" };
  }

  return {
    status: "ready",
    syllabus: {
      goal: { id: goal.id, kind: goal.kind, title: goal.title },
      ...buildSyllabus(syllabusInput),
    },
  };
}
