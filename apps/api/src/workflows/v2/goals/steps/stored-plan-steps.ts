import { createStepStream } from "@/workflows/_shared/stream-status";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { setGoalPrimaryCourse } from "@zoonk/core/library/curriculum/goal-primary-course";
import {
  type PlanSkillGraph,
  loadPlanSkillGraph,
} from "@zoonk/core/library/curriculum/plan-skill-graph";
import { findReusableCurriculum } from "@zoonk/core/library/curriculum/reusable-curriculum";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { getRun } from "workflow/api";
import { type BuiltCurriculum } from "../goal-curriculum";
import { type GoalStreamStep } from "./goal-progress-step";

function toBuiltCurriculum({
  generatedAt,
  stored,
}: {
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

async function readRunStart(runId: string): Promise<Date | null> {
  const run = getRun(runId);
  return (await run.exists) ? run.createdAt : null;
}

export async function loadStoredCurriculumStep({
  goalId,
  researchId,
}: {
  goalId: string;
  researchId: string;
}): Promise<BuiltCurriculum | null> {
  "use step";

  const [stored, startedAt] = await Promise.all([
    loadPlanSkillGraph(goalId),
    readRunStart(researchId),
  ]);

  if (!stored?.plannedAt || !startedAt || startedAt <= stored.plannedAt) {
    return null;
  }

  return toBuiltCurriculum({ stored });
}

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
