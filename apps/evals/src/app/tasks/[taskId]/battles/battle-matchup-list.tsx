"use client";

import { getModelById, getModelDisplayName } from "@/lib/models";
import { type BattleMatchup } from "@/lib/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@zoonk/ui/components/accordion";
import { Badge } from "@zoonk/ui/components/badge";
import { RankingItem } from "./ranking-item";

function MatchupItem({ matchup }: { matchup: BattleMatchup }) {
  // Get all unique models from the matchup
  const modelIds = new Set<string>();
  for (const judgment of matchup.judgments) {
    for (const ranking of judgment.rankings) {
      modelIds.add(ranking.modelId);
    }
  }

  // Build a map of model rankings by model ID
  const modelRankings = new Map<
    string,
    {
      judgeId: string;
      judgeName: string;
      score: number;
      reasoning: string;
      anonymousId: string;
    }[]
  >();

  for (const modelId of modelIds) {
    modelRankings.set(modelId, []);
  }

  for (const judgment of matchup.judgments) {
    const judgeModel = getModelById(judgment.judgeId);
    const judgeName = judgeModel ? getModelDisplayName(judgeModel) : judgment.judgeId;

    for (const ranking of judgment.rankings) {
      const rankings = modelRankings.get(ranking.modelId);
      if (rankings) {
        rankings.push({
          anonymousId: ranking.anonymousId,
          judgeId: judgment.judgeId,
          judgeName,
          reasoning: ranking.reasoning,
          score: ranking.score,
        });
      }
    }
  }

  // Sort models by total score
  const sortedModels = [...modelIds].toSorted((a, b) => {
    const aTotal = modelRankings.get(a)?.reduce((sum, ranking) => sum + ranking.score, 0) ?? 0;
    const bTotal = modelRankings.get(b)?.reduce((sum, ranking) => sum + ranking.score, 0) ?? 0;
    return bTotal - aTotal;
  });

  return (
    <AccordionItem value={matchup.testCaseId}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex flex-col items-start gap-1">
          <span className="font-semibold">{matchup.testCaseId}</span>
          <span className="text-muted-foreground text-sm">
            {matchup.judgments.length} judge(s) &bull; {matchup.judgments[0]?.rankings.length ?? 0}{" "}
            models ranked
          </span>
        </div>
      </AccordionTrigger>

      <AccordionContent className="flex flex-col gap-6 pt-4">
        {sortedModels.map((modelId) => {
          const model = getModelById(modelId);
          const modelName = model ? getModelDisplayName(model) : modelId;
          const rankings = modelRankings.get(modelId) ?? [];
          const totalScore = rankings.reduce((sum, ranking) => sum + ranking.score, 0);

          return (
            <div className="border-border rounded-lg border p-4" key={modelId}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{modelName}</h3>
                  <p className="text-muted-foreground text-sm">{modelId}</p>
                </div>
                <Badge className="text-lg" variant="secondary">
                  {totalScore.toFixed(1)} pts
                </Badge>
              </div>

              <div className="flex flex-col gap-3">
                {rankings.map((ranking) => (
                  <RankingItem
                    anonymousId={ranking.anonymousId}
                    judgeName={ranking.judgeName}
                    key={ranking.judgeId}
                    reasoning={ranking.reasoning}
                    score={ranking.score}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <details>
          <summary className="text-muted-foreground cursor-pointer text-sm hover:underline">
            View test case expectations
          </summary>
          <pre className="bg-muted mt-2 overflow-auto rounded-lg p-4 text-xs">
            {matchup.expectations}
          </pre>
        </details>
      </AccordionContent>
    </AccordionItem>
  );
}

export function BattleMatchupList({ matchups }: { matchups: BattleMatchup[] }) {
  if (matchups.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center">
        No battle results yet. Run Battle Mode first.
      </p>
    );
  }

  return (
    <Accordion>
      {matchups.map((matchup) => (
        <MatchupItem key={matchup.testCaseId} matchup={matchup} />
      ))}
    </Accordion>
  );
}
