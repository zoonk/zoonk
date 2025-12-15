import { Accordion } from "@zoonk/ui/components/accordion";
import { ContainerTitle } from "@zoonk/ui/components/container";
import { calculateAverageScore } from "@/lib/leaderboard";
import { getModelById } from "@/lib/models";
import { getStatsFromResults } from "@/lib/stats";
import type { TaskEvalResults } from "@/lib/types";
import { SummaryCard } from "./summary-card";
import { TestCase } from "./test-case";

type EvalResultsProps = {
  results: TaskEvalResults;
};

export function EvalResults({ results }: EvalResultsProps) {
  const model = getModelById(results.modelId);
  const stats = getStatsFromResults(results);
  const averageScore = calculateAverageScore(results);

  if (!model) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      <SummaryCard
        averageDuration={stats.averageDuration}
        averageInputTokens={stats.averageInputTokens}
        averageOutputTokens={stats.averageOutputTokens}
        averageScore={averageScore}
        totalCost={stats.totalCost}
      />

      <div className="flex flex-col gap-4">
        <ContainerTitle>Test Cases</ContainerTitle>

        <Accordion className="w-full">
          {results.results.map((result, index) => (
            <TestCase
              index={index}
              key={result.testCase.id || index}
              result={result}
            />
          ))}
        </Accordion>
      </div>
    </div>
  );
}
