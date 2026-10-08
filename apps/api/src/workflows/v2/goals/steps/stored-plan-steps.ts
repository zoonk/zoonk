import { createStepStream } from "@/workflows/_shared/stream-status";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { setGoalPrimaryCourse } from "@zoonk/core/library/curriculum/goal-primary-course";
import {
  type PlanSkillGraph,
  loadPlanSkillGraph,
} from "@zoonk/core/library/curriculum/plan-skill-graph";
import { findReusableCurriculum } from "@zoonk/core/library/curriculum/reusable-curriculum";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { safeAsync } from "@zoonk/utils/error";
import { getRun } from "workflow/api";
import { type BuiltCurriculum } from "../goal-curriculum";
import { type GoalStreamStep } from "./goal-progress-step";

/** A stored plan's curriculum as a build's: its graph run wrote it, with no new usage. */
function toBuiltCurriculum({
  generatedAt,
  stored,
}: {
  /** When the plan made from it counts as written: a reused graph's plan is written now. */
  generatedAt?: string;
  stored: PlanSkillGraph;
}): BuiltCurriculum {
  const { model } = stored.provenance;

  return {
    courseIdsByKey: stored.courseIdsByKey,
    graph: stored.graph,
    idsByKey: stored.idsByKey,
    provenance: {
      ...stored.provenance,
      generatedAt: generatedAt ?? stored.provenance.generatedAt,
      latencyMs: 0,
      provider: "",
      requestedModel: model,
      usage: {},
    },
  };
}

/**
 * The curriculum a goal's stored plan stands for, when research `researchId` started after the
 * plan was built (research restarted, as after a run that failed or stalled): the run that built
 * the plan reconciled it with research that ended before, so this reading would reach nothing.
 * Null otherwise, or when the plan or the run can't be read.
 */
export async function loadStoredCurriculumStep({
  goalId,
  researchId,
}: {
  goalId: string;
  researchId: string;
}): Promise<BuiltCurriculum | null> {
  "use step";

  const [stored, { data: startedAt }] = await Promise.all([
    loadPlanSkillGraph(goalId),
    safeAsync(() => getRun(researchId).createdAt),
  ]);

  if (!stored?.plannedAt || !startedAt || startedAt <= stored.plannedAt) {
    return null;
  }

  return toBuiltCurriculum({ stored });
}

/**
 * The curriculum another learner's goal built for the same exam notice, when one fits this goal
 * (`findReusableCurriculum`): it stands for this goal's skill graph, whose Library skills and
 * courses it already names, and its main course becomes this goal's. Its plan counts as written
 * now, so placement waits for the questions still being written. Null when none fits.
 */
export async function reuseCurriculumStep({
  inputs,
  scope,
}: {
  inputs: GoalCurriculumInputs;
  scope: CurriculumScope;
}): Promise<BuiltCurriculum | null> {
  "use step";

  const reusable = await findReusableCurriculum({ inputs, scope });

  if (!reusable) {
    return null;
  }

  const goalId = inputs.goal.id;
  const courseId = reusable.primaryCourseId ?? Object.values(reusable.courseIdsByKey)[0];

  await using stream = createStepStream<GoalStreamStep>();
  await stream.status({ entityId: goalId, status: "started", step: "buildSkillGraph" });

  if (courseId) {
    await setGoalPrimaryCourse({ courseId, goalId });
  }

  await stream.status({ entityId: goalId, status: "completed", step: "buildSkillGraph" });

  return toBuiltCurriculum({ generatedAt: new Date().toISOString(), stored: reusable });
}
