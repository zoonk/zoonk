import { loadGatewayPrices } from "@/lib/gateway-prices";
import { calculateAverageScore } from "@/lib/leaderboard";
import { getStatsFromResults } from "@/lib/stats";
import { type TaskEvalResults } from "@/lib/types";
import { Accordion } from "@zoonk/ui/components/accordion";
import { ContainerTitle } from "@zoonk/ui/components/container";
import { ClassificationSummaryCard } from "./classification-summary-card";
import { IssuesSummary } from "./issues-summary";
import { SummaryCard } from "./summary-card";
import { TestCase } from "./test-case";

export async function EvalResults({ results }: { results: TaskEvalResults }) {
  const prices = await loadGatewayPrices();
  const stats = getStatsFromResults({ evalResults: results, prices });

  return (
    <div className="flex flex-col gap-8">
      <SummaryCard averageScore={calculateAverageScore(results)} stats={stats} />

      {stats.classification && <ClassificationSummaryCard summary={stats.classification} />}

      <IssuesSummary results={results.results} />

      <div className="flex flex-col gap-4">
        <ContainerTitle>Test Cases</ContainerTitle>

        <Accordion className="w-full">
          {results.results.map((result, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- Fallback key when testCase.id is falsy
            <TestCase index={index} key={result.testCase.id || index} result={result} />
          ))}
        </Accordion>
      </div>
    </div>
  );
}
