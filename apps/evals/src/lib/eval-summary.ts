import { calculateScore } from "./score-calculation";
import { type FailureReason, type TaskEvalResults } from "./types";

export const FAILURE_REASONS = ["schema", "provider", "other", "unknown"] as const;
type ReportedFailureReason = FailureReason | "unknown";
type FailureCount = { count: number; caseIds: string[] };

export type EvalSummary = {
  attempted: number;
  generated: number;
  scored: number;
  averageScore: number | null;
  caseIds: { attempted: string[]; generated: string[]; scored: string[] };
  failures: Record<ReportedFailureReason, FailureCount>;
  keyFlaws: {
    flagged: number;
    itemsScored: number;
    casesAffected: string[];
    recordedOutputs: number;
    notRecorded: number;
  };
};

export function aggregateEvalResults({
  outputs,
  results,
  failedRuns = [],
}: Pick<TaskEvalResults, "outputs" | "results" | "failedRuns">): EvalSummary {
  const generatedIds = outputs.map((output) => output.testCaseId);
  const scoredIds = results.map((result) => result.testCase.id);

  const recorded = results.filter(
    (result) => result.keyFlaws !== undefined && result.itemsScored !== undefined,
  );

  const totalScore = results.reduce((total, result) => total + calculateScore(result), 0);

  function countFailures(reason: ReportedFailureReason): FailureCount {
    const runs = failedRuns.filter((run) => (run.reason ?? "unknown") === reason);
    return { caseIds: [...new Set(runs.map((run) => run.testCaseId))], count: runs.length };
  }

  return {
    attempted: outputs.length + failedRuns.length,
    averageScore: results.length === 0 ? null : totalScore / results.length,
    caseIds: {
      attempted: [...new Set([...generatedIds, ...failedRuns.map((run) => run.testCaseId)])],
      generated: generatedIds,
      scored: scoredIds,
    },
    failures: {
      other: countFailures("other"),
      provider: countFailures("provider"),
      schema: countFailures("schema"),
      unknown: countFailures("unknown"),
    },
    generated: outputs.length,
    keyFlaws: {
      casesAffected: recorded
        .filter((result) => (result.keyFlaws?.length ?? 0) > 0)
        .map((result) => result.testCase.id),
      flagged: recorded.reduce((total, result) => total + (result.keyFlaws?.length ?? 0), 0),
      itemsScored: recorded.reduce((total, result) => total + (result.itemsScored ?? 0), 0),
      notRecorded: results.length - recorded.length,
      recordedOutputs: recorded.length,
    },
    scored: results.length,
  };
}

export function formatKeyFlaws({ keyFlaws }: EvalSummary): string {
  if (keyFlaws.recordedOutputs === 0) {
    return "not recorded";
  }

  const missing = keyFlaws.notRecorded > 0 ? `; ${keyFlaws.notRecorded} outputs not recorded` : "";
  return `${keyFlaws.flagged}/${keyFlaws.itemsScored} items scored; ${keyFlaws.casesAffected.length} ${keyFlaws.casesAffected.length === 1 ? "case" : "cases"}${missing}`;
}

export function formatFailureCounts(summary: EvalSummary): string {
  return FAILURE_REASONS.map((reason) => `${reason}: ${summary.failures[reason].count}`).join(", ");
}

export function getCaseHref({
  caseId,
  modelId,
  taskId,
}: {
  caseId: string;
  modelId: string;
  taskId: string;
}): string {
  return `/tasks/${taskId}/${encodeURIComponent(modelId)}#case-${encodeURIComponent(caseId)}`;
}

export const HISTORICAL_ATTEMPTS_NOTE =
  "Recorded attempts are a lower bound for historical runs: older failures may not have been saved.";
