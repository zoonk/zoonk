import { type EvalSummary, FAILURE_REASONS, formatKeyFlaws, getCaseHref } from "@/lib/eval-summary";

export function CaseCount({
  caseIds,
  count,
  model,
  text,
}: {
  caseIds: string[];
  count: number;
  model?: { modelId: string; taskId: string };
  text?: string;
}) {
  if (caseIds.length === 0) {
    return <span>{text ?? count}</span>;
  }

  return (
    <details className="min-w-11">
      <summary className="min-h-11 cursor-pointer content-center">{text ?? count}</summary>
      <ul className="mt-1 space-y-1 text-sm font-normal">
        {caseIds.map((caseId) => (
          <li key={caseId}>
            <a
              className="block min-h-11 min-w-11 content-center break-all underline underline-offset-4"
              href={
                model ? getCaseHref({ ...model, caseId }) : `#case-${encodeURIComponent(caseId)}`
              }
            >
              {caseId}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function FailureCounts({
  summary,
  model,
}: {
  summary: EvalSummary;
  model?: { modelId: string; taskId: string };
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      {FAILURE_REASONS.map((reason) => (
        <div className="flex gap-2" key={reason}>
          <span>{reason}:</span>
          <CaseCount {...summary.failures[reason]} model={model} />
        </div>
      ))}
    </div>
  );
}

export function KeyFlawCount({
  summary,
  model,
}: {
  summary: EvalSummary;
  model?: { modelId: string; taskId: string };
}) {
  return (
    <CaseCount
      caseIds={summary.keyFlaws.casesAffected}
      count={summary.keyFlaws.flagged}
      model={model}
      text={formatKeyFlaws(summary)}
    />
  );
}
