import { ContainerTitle } from "@zoonk/ui/components/container";
import { calculateAverageScore } from "@/lib/leaderboard";
import { getModelById } from "@/lib/models";
import { getStatsFromResults } from "@/lib/stats";
import type { TaskEvalResults } from "@/lib/types";
import { SummaryCard } from "./summary-card";
import { TestCase } from "./test-case";

interface EvalResultsProps {
  results: TaskEvalResults;
}

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
        averageScore={averageScore}
        averageInputTokens={stats.averageInputTokens}
        averageOutputTokens={stats.averageOutputTokens}
        totalCost={stats.totalCost}
      />

      <div className="flex flex-col gap-4">
        <ContainerTitle>Test Cases</ContainerTitle>

        <div className="flex flex-col gap-4">
          {results.results.map((result, index) => (
            <TestCase
              key={result.testCase.id || index}
              result={result}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
