import { chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  loadExamGraphReconcile,
  saveReconciledExamGraph,
} from "@zoonk/core/library/curriculum/exam-graph-repair";
import { toGoalPlanGraph } from "@zoonk/core/library/curriculum/goal-plan-graph";
import { toNoticeReferences } from "@zoonk/core/library/curriculum/notice-graph-sections";
import { toContentAnalytics } from "../../_shared/content-analytics";
import { type GoalRunContext } from "../../goals/goal-run-context";
import { type NoticeGraphParams } from "../../goals/steps/notice-graph-steps";

export async function loadExamNoticeReconcileStep({
  context,
  examBlueprintId,
}: {
  context: GoalRunContext;
  examBlueprintId: string;
}) {
  "use step";

  const state = await loadExamGraphReconcile(examBlueprintId);

  if (!state) {
    return null;
  }

  const { outline, scope } = state;

  return {
    ...state,
    params: {
      analytics: toContentAnalytics({ ...context, scope }),
      examBlueprint: outline,
      goal: scope.generalGoal ?? outline.name,
      goalKind: "exam",
      language: scope.language,
      serviceTier: chooseServiceTier({ wait: "later" }),
    } satisfies NoticeGraphParams,
    references: toNoticeReferences(outline),
  };
}

export async function saveExamNoticeReconcileStep({
  examBlueprintId,
  reconciled,
  storedGraph,
  structure,
}: Omit<Parameters<typeof saveReconciledExamGraph>[0], "graph"> & {
  reconciled: Parameters<typeof toGoalPlanGraph>[0];
}) {
  "use step";

  return saveReconciledExamGraph({
    examBlueprintId,
    graph: toGoalPlanGraph(reconciled),
    storedGraph,
    structure,
  });
}
