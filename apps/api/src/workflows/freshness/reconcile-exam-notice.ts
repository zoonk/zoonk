import { getWorkflowMetadata } from "workflow";
import { mergeAddedTwins, saveAddedSkills } from "../goals/goal-added-skills";
import { findGoalCourses } from "../goals/goal-courses";
import { reconcileNoticeGraph } from "../goals/reconcile-notice-graph";
import { type ResearchAnalytics } from "../research/_utils/research-analytics";
import {
  loadExamNoticeReconcileStep,
  saveExamNoticeReconcileStep,
} from "./steps/exam-graph-reconcile-steps";

export async function reconcileExamNotice({
  analytics,
  examBlueprintId,
}: {
  analytics: ResearchAnalytics;
  examBlueprintId: string;
}): Promise<void> {
  const { workflowRunId } = getWorkflowMetadata();
  const context = { analytics, workflowRunId };
  const state = await loadExamNoticeReconcileStep({ context, examBlueprintId });

  if (!state) {
    return;
  }

  const { curriculum, params, references, scope, storedGraph, structure } = state;
  const checked = await reconcileNoticeGraph({ graph: curriculum.graph, params, references });

  if (!checked.changed) {
    return;
  }

  const graph = await mergeAddedTwins({ context, curriculum, graph: checked.graph, scope });
  const { provenance, provenanceByKey } = checked;

  const [courseIdsByKey, idsByKey] = await Promise.all([
    findGoalCourses({
      ...context,
      courses: graph.courses,
      goal: { kind: "exam" },
      product: null,
      provenance,
      resolved: curriculum.courseIdsByKey,
      scope,
      serviceTier: params.serviceTier,
    }),
    saveAddedSkills({ context, curriculum, graph, provenance, provenanceByKey, scope }),
  ]);

  await saveExamNoticeReconcileStep({
    examBlueprintId,
    reconciled: { courseIdsByKey, graph, idsByKey },
    storedGraph,
    structure,
  });
}
