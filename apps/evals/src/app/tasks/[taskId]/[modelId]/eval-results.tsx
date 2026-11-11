import { aggregateEvalResults } from "@/lib/eval-summary";
import { getStatsFromResults } from "@/lib/stats";
import { type TaskEvalResults, type TaskModelOutputResults } from "@/lib/types";
import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import { Accordion } from "@zoonk/ui/components/accordion";
import { ClassificationSummaryCard } from "./classification-summary-card";
import { IssuesSummary } from "./issues-summary";
import { SummaryCard } from "./summary-card";
import { FailedTestCase, OutputTestCase, TestCase } from "./test-case";

export async function EvalResults({
  results,
  outputs,
}: {
  results: TaskEvalResults;
  outputs: TaskModelOutputResults;
}) {
  const prices = GATEWAY_PRICES;
  const stats = getStatsFromResults({ evalResults: results, prices });

  return (
    <div className="flex flex-col gap-8">
      <SummaryCard summary={aggregateEvalResults(results)} stats={stats} />

      {stats.classification && <ClassificationSummaryCard summary={stats.classification} />}

      <IssuesSummary results={results.results} />

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Test Cases</h2>

        <Accordion className="w-full">
          {outputs.outputs.map((output, index) => {
            const result = results.results.find((entry) => entry.testCase.id === output.testCaseId);

            return result ? (
              <TestCase index={index} key={output.testCaseId} result={result} />
            ) : (
              <OutputTestCase index={index} key={output.testCaseId} output={output} />
            );
          })}
        </Accordion>

        {[...Map.groupBy(results.failedRuns ?? [], (run) => run.testCaseId)].map(
          ([caseId, runs]) => (
            <FailedTestCase
              anchored={!results.outputs.some((output) => output.testCaseId === caseId)}
              caseId={caseId}
              key={caseId}
              runs={runs}
            />
          ),
        )}
      </div>
    </div>
  );
}
